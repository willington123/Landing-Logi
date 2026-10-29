// Scheduled work (AI call retries/scheduled calls, WhatsApp fallback templates).
// Woken up by /api/cron/run (Supabase pg_cron, cron-job.org or Vercel Cron) and, as a backup,
// by landing visits and the panel (at most once every few minutes).
import { timingSafeEqual } from 'crypto';
import { cloudEnabled, db } from '@/lib/server/db';
import { processCallQueue } from '@/lib/server/voice-actions';
import { processWaFallback } from '@/lib/server/wa-actions';

export type RunSource = 'cron' | 'visita' | 'panel';

export interface SchedulerInfo {
  lastRunAt?: string;
  lastSource?: RunSource;
  lastCronAt?: string; // last run started by the scheduled task itself
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
  const { data } = await db().from('settings').select('data').eq('id', 'scheduler').maybeSingle();
  return (data?.data as SchedulerInfo) || {};
}

async function noteRun(source: RunSource) {
  const now = new Date().toISOString();
  const current = await getSchedulerInfo().catch(() => ({}) as SchedulerInfo);
  await db()
    .from('settings')
    .upsert({ id: 'scheduler', data: { ...current, lastRunAt: now, lastSource: source, ...(source === 'cron' ? { lastCronAt: now } : {}) } });
}

export async function runScheduled(origin?: string, source: RunSource = 'cron') {
  if (!cloudEnabled()) return { calls: null, whatsapp: null };
  await noteRun(source).catch(() => {});
  const [calls, whatsapp] = await Promise.all([
    processCallQueue(origin).catch((e) => ({ error: String(e?.message || e) })),
    processWaFallback().catch((e) => ({ error: String(e?.message || e) })),
  ]);
  return { calls, whatsapp };
}

// Backup trigger: runs the scheduled work if nobody did in the last few minutes. Never throws.
export async function maybeRunScheduled(origin: string | undefined, source: RunSource) {
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
