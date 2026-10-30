import { NextRequest } from 'next/server';
import { getUser, renameOrg, userOrgs } from '@/lib/server/accounts';
import { getSubscription, isPlatformAdmin } from '@/lib/server/billing';
import { currentOrgId, currentRole, envIntegrationsAllowed, sessionUserId } from '@/lib/server/tenant';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// The signed-in person, their current store (account) and the other stores they belong to.
export async function GET() {
  try {
    const orgId = await currentOrgId();
    const uid = sessionUserId()!;
    const [user, orgs, role, sub] = await Promise.all([getUser(uid), userOrgs(uid), currentRole(), getSubscription(orgId).catch(() => null)]);
    const org = orgs.find((o) => o.id === orgId);
    return ok({
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      org: org ? { id: org.id, name: org.name, role } : null,
      orgs: orgs.map((o) => ({ id: o.id, name: o.name, role: o.role })),
      integrationsManaged: envIntegrationsAllowed(),
      platformAdmin: isPlatformAdmin(user?.email),
      plan: sub
        ? { id: sub.plan, name: sub.planInfo.name, status: sub.status, effective: sub.effective, daysLeft: sub.daysLeft, panelLocked: sub.panelLocked, landingsOff: sub.landingsOff, accessEndsAt: sub.accessEndsAt }
        : null,
    });
  } catch (e) {
    return failFrom(e);
  }
}

// Rename the current store. Owners and admins.
export async function PATCH(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    const role = await currentRole();
    if (role !== 'owner' && role !== 'admin') return fail('Solo el dueño o un administrador pueden cambiar el nombre.', 403);
    const { name } = await req.json().catch(() => ({}));
    const clean = String(name || '').trim();
    if (!clean) return fail('Escribe el nombre de la tienda.');
    await renameOrg(orgId, clean);
    return ok({ name: clean.slice(0, 80) });
  } catch (e) {
    return failFrom(e);
  }
}
