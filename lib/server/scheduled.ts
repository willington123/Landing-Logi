// Scheduled work (AI call retries/scheduled calls, WhatsApp fallback templates).
// Woken up by /api/cron/run (Supabase pg_cron, cron-job.org or Vercel Cron) and, as a backup,
// by landing visits and the panel (at most once every few minutes).
import { timingSafeEqual } from 'crypto';
import { cloudEnabled, db } from '@/lib/server/db';
import { processCallQueue } from '@/lib/server/voice-actions';
import { processWaFallback } from '@/lib/server/wa-actions';
import { integrationsOrg, runWithOrg } from '@/lib/server/tenant';
import { orgsWithConnections } from '@/lib/server/integrations';
import { processBilling } from '@/lib/server/billing';

export type RunSource = 'cron' | 'visita' | 'panel';

export interface SchedulerInfo {
  lastRunAt?: string;
  lastSource?: RunSource;
  lastCronAt?: string; // last run started by the scheduled task itself
  lastDeniedAt?: string; // last call to /api/cron/run with a wrong CRON_SECRET
  lastWa?: { at: string; sent: number; failed: number; error?: string }; // last run that sent (or tried) fallback templates
  lastError?: { at: string; error: string };
}

const BACKUP_EVERY_MS = 3 * 60 * 1000;

export function cronAuthorized(authHeader: string | null, querySecret: string | null): 'ok' | 'missing' | 'denied' {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return 'missing';
  const given = (authHeader || '').replace(/^Bearer\s+/i, '') || querySecret || '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b) ? 'ok' : 'denied';
}

export async function getSchedulerInfo(): Promise<SchedulerInfo> {
  const { data } = await (await db()).from('settings').select('data').eq('id', 'scheduler').maybeSingle();
  return (data?.data as SchedulerInfo) || {};
}

async function noteRun(source: RunSource) {
  const now = new Date().toISOString();
  const current = await getSchedulerInfo().catch(() => ({}) as SchedulerInfo);
  await (await db())
    .from('settings')
    .upsert({ id: 'scheduler', data: { ...current, lastRunAt: now, lastSource: source, ...(source === 'cron' ? { lastCronAt: now } : {}) } });
}

async function patchInfo(patch: Partial<SchedulerInfo>) {
  const current = await getSchedulerInfo().catch(() => ({}) as SchedulerInfo);
  await (await db()).from('settings').upsert({ id: 'scheduler', data: { ...current, ...patch } });
}

// A call with the wrong secret (e.g. CRON_SECRET changed after the SQL was copied). At most once a minute.
export async function noteDenied() {
  return runWithOrg(integrationsOrg(), noteDeniedForOrg);
}

async function noteDeniedForOrg() {
  try {
    if (!cloudEnabled()) return;
    const info = await getSchedulerInfo();
    if (info.lastDeniedAt && Date.now() - new Date(info.lastDeniedAt).getTime() < 60 * 1000) return;
    await patchInfo({ lastDeniedAt: new Date().toISOString() });
  } catch {
    // diagnostics only
  }
}

// Runs the pending work of every store with WhatsApp or Vapi connected (each inside its own store).
// Returns the main store's result plus how many stores ran.
export async function runScheduled(origin?: string, source: RunSource = 'cron') {
  const orgs = cloudEnabled() ? await orgsWithConnections().catch(() => [integrationsOrg()]) : [integrationsOrg()];
  let main: Awaited<ReturnType<typeof runScheduledForOrg>> = { calls: null, whatsapp: null };
  for (const org of orgs) {
    const r = await runWithOrg(org, () => runScheduledForOrg(origin, source)).catch((e) => {
      console.error('Tareas programadas:', org, e);
      return { calls: null, whatsapp: null };
    });
    if (org === integrationsOrg()) main = r;
  }
  // Plans: automatic monthly charges and payments Wompi hasn't confirmed yet (platform-wide).
  const billing = cloudEnabled() ? await processBilling().catch((e) => ({ error: String(e?.message || e) })) : null;
  return { ...main, stores: orgs.length, billing };
}

async function runScheduledForOrg(origin: string | undefined, source: RunSource) {
  if (!cloudEnabled()) return { calls: null, whatsapp: null };
  await noteRun(source).catch(() => {});
  const [calls, whatsapp] = await Promise.all([
    processCallQueue(origin).catch((e) => ({ error: String(e?.message || e) })),
    processWaFallback().catch((e) => ({ sent: 0, failed: 0, error: String(e?.message || e) })),
  ]);
  // Keep what happened so the panel can explain it.
  const now = new Date().toISOString();
  const patch: Partial<SchedulerInfo> = {};
  if (whatsapp.sent || whatsapp.failed) patch.lastWa = { at: now, sent: whatsapp.sent, failed: whatsapp.failed, error: whatsapp.error };
  const err = (whatsapp.error && !whatsapp.sent && !whatsapp.failed ? whatsapp.error : '') || ('error' in (calls || {}) ? String((calls as any).error) : '');
  if (err) patch.lastError = { at: now, error: err };
  if (Object.keys(patch).length) await patchInfo(patch).catch(() => {});
  return { calls, whatsapp };
}

// Backup trigger: runs the scheduled work if nobody did in the last few minutes. Never throws.
export async function maybeRunScheduled(origin: string | undefined, source: RunSource) {
  return runWithOrg(integrationsOrg(), () => maybeRunScheduledForOrg(origin, source));
}

async function maybeRunScheduledForOrg(origin: string | undefined, source: RunSource) {
  try {
    if (!cloudEnabled()) return;
    const info = await getSchedulerInfo();
    if (info.lastRunAt && Date.now() - new Date(info.lastRunAt).getTime() < BACKUP_EVERY_MS) return;
    await runScheduled(origin, source);
  } catch (e) {
    console.error('Tareas programadas (respaldo):', e);
  }
}

// SQL for Supabase (pg_cron + pg_net) that calls /api/cron/run every 5 minutes.
export function supabaseCronSql(baseUrl: string): string | null {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret || !baseUrl) return null;
  const q = (s: string) => s.replace(/'/g, "''");
  return `-- LogiPages: revisión automática cada 5 minutos (llamadas IA y plantillas de WhatsApp de respaldo).
-- Pégalo en Supabase → SQL Editor → New query → Run. Se puede volver a ejecutar sin problema.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'logipages-tareas',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := '${q(baseUrl)}/api/cron/run',
      headers := jsonb_build_object('Authorization', 'Bearer ${q(secret)}'),
      timeout_milliseconds := 30000
    );
  $job$
);`;
}
