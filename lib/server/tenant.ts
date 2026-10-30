// Which account (organization) the current code runs for.
// - Panel requests: the session verified by the middleware (headers x-lp-org / x-lp-uid / x-lp-sv), re-checked against the database.
// - Public pages, webhooks and scheduled tasks: set explicitly with runWithOrg().
import { AsyncLocalStorage } from 'async_hooks';
import { headers } from 'next/headers';
import { rawDb } from '@/lib/server/supabase';
import { access } from '@/lib/server/billing';

import { MAIN_ORG } from '@/lib/server/constants';
export { MAIN_ORG };

const als = new AsyncLocalStorage<{ orgId: string }>();

export function runWithOrg<T>(orgId: string, fn: () => T): T {
  return als.run({ orgId }, fn);
}

export class AuthError extends Error {
  status = 401;
}

// The store's plan ended: only the Plan page (and account/team) keeps working.
export class PaymentRequired extends Error {
  status = 402;
}
const OPEN_WHEN_LOCKED = ['/api/account', '/api/billing', '/api/team', '/api/status', '/api/auth', '/api/admin'];
function requestPath(): string {
  try {
    return headers().get('x-lp-path') || '';
  } catch {
    return '';
  }
}

function sessionHeaders(): { org: string; uid: string; sv: number } | null {
  try {
    const h = headers();
    const org = h.get('x-lp-org');
    const uid = h.get('x-lp-uid');
    if (!org || !uid) return null;
    return { org, uid, sv: Number(h.get('x-lp-sv') || 0) };
  } catch {
    return null; // not inside a request
  }
}

// Org without database checks (for quick decisions such as "may this account use the env integrations?").
export function requestOrgSync(): string | null {
  return als.getStore()?.orgId ?? sessionHeaders()?.org ?? null;
}

export function sessionUserId(): string | null {
  return sessionHeaders()?.uid ?? null;
}

// Membership checks are cached a few seconds (one page load makes several requests). Each server instance
// keeps its own copy, so a removed member or a changed password takes effect within MEMBER_TTL_MS everywhere.
const memberCache = new Map<string, { ok: boolean; role: string | null; until: number }>();
const MEMBER_TTL_MS = 5_000;

export async function membership(uid: string, org: string, sv: number): Promise<{ ok: boolean; role: string | null }> {
  const key = `${uid}|${org}|${sv}`;
  const hit = memberCache.get(key);
  if (hit && hit.until > Date.now()) return hit;
  const [{ data: user }, { data: m }] = await Promise.all([
    rawDb().from('app_users').select('session_version').eq('id', uid).maybeSingle(),
    rawDb().from('memberships').select('role').eq('org_id', org).eq('user_id', uid).maybeSingle(),
  ]);
  const ok = Boolean(user && Number(user.session_version) === sv && m);
  const res = { ok, role: (m?.role as string) || null, until: Date.now() + MEMBER_TTL_MS };
  if (memberCache.size > 2000) memberCache.clear();
  memberCache.set(key, res);
  return res;
}

export function forgetMembership() {
  memberCache.clear();
}

// The current account, verified. Throws AuthError when there is no valid session.
export async function currentOrgId(): Promise<string> {
  const store = als.getStore();
  if (store) return store.orgId;
  const s = sessionHeaders();
  if (!s) throw new AuthError('No autorizado. Inicia sesión en el panel.');
  const m = await membership(s.uid, s.org, s.sv);
  if (!m.ok) throw new AuthError('Tu sesión ya no es válida. Vuelve a iniciar sesión.');
  const path = requestPath();
  if (path.startsWith('/api/') && !OPEN_WHEN_LOCKED.some((p) => path.startsWith(p)) && (await access(s.org)).locked) {
    throw new PaymentRequired('Tu plan venció. Elige un plan en Plan y pagos para seguir usando el panel.');
  }
  return s.org;
}

export async function currentRole(): Promise<string | null> {
  const s = sessionHeaders();
  if (!s) return null;
  const m = await membership(s.uid, s.org, s.sv);
  return m.ok ? m.role : null;
}

// The WhatsApp, Vapi, Meta CAPI and Claude keys set in Vercel belong to one account (the original store).
// Other accounts connect their own integrations in a later phase.
export function integrationsOrg(): string {
  return (process.env.INTEGRATIONS_ORG_ID || '').trim() || MAIN_ORG;
}

export function envIntegrationsAllowed(): boolean {
  const org = requestOrgSync();
  return !org || org === integrationsOrg();
}
