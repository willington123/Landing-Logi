import { NextRequest } from 'next/server';
import { ROLES, createInvite, listInvites, listMembers, normalizeEmail, removeMember, revokeInvite, setMemberRole, validEmail, type Role } from '@/lib/server/accounts';
import { currentOrgId, currentRole, sessionUserId } from '@/lib/server/tenant';
import { publicBaseUrl } from '@/lib/server/vapi';
import { fail, failFrom, ok } from '@/lib/server/http';
import { assertCanAddMember } from '@/lib/server/billing';

export const dynamic = 'force-dynamic';

const canManage = (r: string | null): r is 'owner' | 'admin' => r === 'owner' || r === 'admin';

// The people in this store and the open invitations.
export async function GET(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    const role = await currentRole();
    const base = publicBaseUrl(req.nextUrl.origin);
    const [members, invites] = await Promise.all([listMembers(orgId), canManage(role) ? listInvites(orgId) : Promise.resolve([])]);
    return ok({
      me: sessionUserId(),
      role,
      members,
      invites: invites.map((i) => ({ token: i.token, role: i.role, email: i.email, expiresAt: i.expires_at, url: `${base}/invitacion/${i.token}` })),
    });
  } catch (e) {
    return failFrom(e);
  }
}

// New invitation link. Body: { role, email? }.
export async function POST(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    const role = await currentRole();
    if (!canManage(role)) return fail('Solo el dueño o un administrador pueden invitar.', 403);
    const body = await req.json().catch(() => ({}));
    const newRole = ROLES.includes(body.role) ? (body.role as Role) : 'member';
    if (newRole === 'owner' && role !== 'owner') return fail('Solo un dueño puede invitar a otro dueño.', 403);
    const email = body.email ? normalizeEmail(body.email) : null;
    if (email && !validEmail(email)) return fail('El correo no es válido.');
    await assertCanAddMember(orgId);
    const invite = await createInvite(orgId, newRole, email, sessionUserId()!);
    return ok({ invite: { token: invite.token, role: invite.role, email: invite.email, expiresAt: invite.expires_at, url: `${publicBaseUrl(req.nextUrl.origin)}/invitacion/${invite.token}` } });
  } catch (e) {
    return failFrom(e);
  }
}

// Change someone's role. Body: { userId, role }.
export async function PATCH(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    const role = await currentRole();
    if (!canManage(role)) return fail('Solo el dueño o un administrador pueden cambiar roles.', 403);
    const { userId, role: next } = await req.json().catch(() => ({}));
    if (!ROLES.includes(next)) return fail('Rol no válido.');
    await setMemberRole(orgId, role, String(userId || ''), next);
    return ok();
  } catch (e: any) {
    if (/dueño|equipo/.test(String(e?.message))) return fail(e.message, 400);
    return failFrom(e);
  }
}

// Remove someone (?userId=) or cancel an invitation (?invite=).
export async function DELETE(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    const role = await currentRole();
    const userId = req.nextUrl.searchParams.get('userId');
    const invite = req.nextUrl.searchParams.get('invite');
    // Anyone can leave a store; managing others needs owner/admin.
    if (userId && userId !== sessionUserId() && !canManage(role)) return fail('Solo el dueño o un administrador pueden quitar personas.', 403);
    if (invite) {
      if (!canManage(role)) return fail('Solo el dueño o un administrador pueden cancelar invitaciones.', 403);
      await revokeInvite(orgId, invite);
    }
    if (userId) await removeMember(orgId, (role as Role) || 'member', userId);
    return ok();
  } catch (e: any) {
    if (/dueño/.test(String(e?.message))) return fail(e.message, 400);
    return failFrom(e);
  }
}
