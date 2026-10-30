// Shared bits for /api/billing routes.
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { Forbidden } from '@/lib/server/integrations-api';

// Paying or changing the plan: owners and admins.
export async function requireBillingManager() {
  const orgId = await currentOrgId();
  const role = await currentRole();
  if (role !== 'owner' && role !== 'admin') throw new Forbidden('Solo el dueño o un administrador pueden pagar o cambiar el plan.');
  return orgId;
}
