// Platform admin (the people in PLATFORM_ADMIN_EMAILS): sees every store, activates plans paid by transfer, edits plans.
import { getUser } from '@/lib/server/accounts';
import { isPlatformAdmin } from '@/lib/server/billing';
import { currentOrgId, sessionUserId } from '@/lib/server/tenant';
import { Forbidden } from '@/lib/server/integrations-api';

export async function requirePlatformAdmin() {
  await currentOrgId(); // valid session
  const user = await getUser(sessionUserId()!);
  if (!user || !isPlatformAdmin(user.email)) throw new Forbidden('Solo el administrador de la plataforma.');
  return user;
}
