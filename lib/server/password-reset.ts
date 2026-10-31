// Password reset links without a new table: the link is signed with the server secret and the user's current
// password hash, so it expires after 1 hour and stops working as soon as the password changes (single use).
import { createHmac, timingSafeEqual } from 'crypto';
import { rawDb } from '@/lib/server/supabase';
import { getUser, hashPassword, type AppUser } from '@/lib/server/accounts';

const TTL_MS = 60 * 60 * 1000;
const secret = () =>
  (process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
const sign = (uid: string, exp: number, hash: string) => createHmac('sha256', `lp-reset:${secret()}`).update(`${uid}.${exp}.${hash}`).digest('base64url');

export function resetToken(user: Pick<AppUser, 'id' | 'password_hash'>, ttl = TTL_MS): string {
  const exp = Date.now() + ttl;
  return `${Buffer.from(user.id).toString('base64url')}.${exp}.${sign(user.id, exp, user.password_hash)}`;
}

export async function userFromResetToken(token: unknown): Promise<AppUser | null> {
  const [u, e, sig] = String(token || '').split('.');
  if (!u || !e || !sig || !secret()) return null;
  const exp = Number(e);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  const uid = Buffer.from(u, 'base64url').toString();
  const user = await getUser(uid);
  if (!user) return null;
  const want = Buffer.from(sign(uid, exp, user.password_hash));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? user : null;
}

// New password; closes every open session of that person.
export async function setPassword(user: AppUser, password: string): Promise<AppUser> {
  const v = (user.session_version || 1) + 1;
  const { error } = await rawDb().from('app_users').update({ password_hash: await hashPassword(password), session_version: v }).eq('id', user.id);
  if (error) throw new Error(error.message);
  return { ...user, session_version: v };
}
