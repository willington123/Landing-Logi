// Simple password protection for the admin panel (works in middleware and route handlers).
// The cookie holds an HMAC of the password, so changing ADMIN_PASSWORD logs everyone out.

export const AUTH_COOKIE = 'lp_admin';

export function authEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export async function expectedToken(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD!.trim();
  const secret = (process.env.AUTH_SECRET || password).trim();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`lp-admin:${password}`));
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
