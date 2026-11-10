// Name of the person signed in, to show who wrote each gasto.
import { sessionUserId } from '@/lib/server/tenant';
import { getUser } from '@/lib/server/accounts';

export async function sessionUserName(): Promise<string | null> {
  const uid = sessionUserId();
  if (!uid) return null;
  const u: any = await getUser(uid).catch(() => null);
  return u ? String(u.name || u.email || '').slice(0, 60) || null : null;
}
