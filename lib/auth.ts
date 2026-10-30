// Sessions for the panel. Works in the middleware (edge) and in route handlers (Web Crypto only).
//
// With Supabase: each person signs in with email + password; the cookie holds a signed session
// { user, organization, session version, expiry }. The middleware checks the signature and passes
// the account to the server in x-lp-* headers; the server re-checks the membership in the database.
// Without Supabase (local demo): the old single password ADMIN_PASSWORD.

export const SESSION_COOKIE = 'lp_session';
export const AUTH_COOKIE = 'lp_admin'; // legacy single-password cookie (no database)
export const SESSION_DAYS = 30;

export interface Session {
  u: string; // user id
  o: string; // organization id
  v: number; // user's session version (bumped on password change / "log out everywhere")
  e: number; // expiry, ms
}

const enc = new TextEncoder();

export function cloudConfigured(): boolean {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  return Boolean(url && key && !key.startsWith('sb_publishable_'));
}

// Signing key: AUTH_SECRET (recommended), else the old panel password, else the database secret.
function authSecret(): string {
  return (process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
}

const b64url = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(`lp-session:${authSecret()}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

export async function signSession(s: Omit<Session, 'e'>, days = SESSION_DAYS): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ ...s, e: Date.now() + days * 86400000 })));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token || !authSecret()) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, await hmac(payload))) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    if (!s.u || !s.o || typeof s.e !== 'number' || s.e < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

// ---------- legacy single password (no database) ----------

export function authEnabled(): boolean {
  return cloudConfigured() || Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export async function expectedToken(): Promise<string> {
  const password = (process.env.ADMIN_PASSWORD || '').trim();
  const secret = (process.env.AUTH_SECRET || password).trim();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`lp-admin:${password}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Constant-time string comparison.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
