import { NextRequest } from 'next/server';
import { ROLES, createInvite, listInvites, listMembers, normalizeEmail, removeMember, revokeInvite, setMemberRole, validEmail, type Role } from '@/lib/server/accounts';
import { currentOrgId, currentRole, sessionUserId } from '@/lib/server/tenant';
import { publicBaseUrl } from '@/lib/server/vapi';
import { fail, failFrom, ok } from '@/lib/server/http';
import { assertCanAddMember } from '@/lib/server/billing';
import { sendInviteEmail } from '@/lib/server/invite-email';
import { emailConfigured } from '@/lib/server/email';

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
      emailEnabled: emailConfigured(),
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
    const base = publicBaseUrl(req.nextUrl.origin);
    // Send the email again for an open invitation: { resend: token }
    if (body.resend) {
      const inv = (await listInvites(orgId)).find((i) => i.token === String(body.resend));
      if (!inv) return fail('Esa invitación ya no existe o venció. Crea una nueva.', 404);
      if (!inv.email) return fail('Esa invitación no tiene correo: copia el enlace y envíaselo.', 400);
      const sent = await sendInviteEmail({ to: inv.email, url: `${base}/invitacion/${inv.token}`, orgId, role: inv.role, invitedBy: sessionUserId(), expiresAt: inv.expires_at });
      return sent.ok ? ok({ emailed: 'sent' }) : fail(sent.skipped ? 'El envío de correos no está configurado.' : `No pudimos enviar el correo: ${sent.error || 'error'}`, 502);
    }
    const newRole = ROLES.includes(body.role) ? (body.role as Role) : 'member';
    if (newRole === 'owner' && role !== 'owner') return fail('Solo un dueño puede invitar a otro dueño.', 403);
    const email = body.email ? normalizeEmail(body.email) : null;
    if (email && !validEmail(email)) return fail('El correo no es válido.');
    await assertCanAddMember(orgId);
    const invite = await createInvite(orgId, newRole, email, sessionUserId()!);
    const url = `${base}/invitacion/${invite.token}`;
    // With an email, the invitation also goes to their inbox.
    let emailed: 'sent' | 'failed' | 'skipped' | null = null;
    let emailError: string | null = null;
    if (email) {
      const sent = await sendInviteEmail({ to: email, url, orgId, role: newRole, invitedBy: sessionUserId(), expiresAt: invite.expires_at }).catch((e) => ({ ok: false, error: String(e?.message || e) }) as { ok: boolean; skipped?: boolean; error?: string });
      emailed = sent.ok ? 'sent' : sent.skipped ? 'skipped' : 'failed';
      emailError = sent.ok ? null : sent.error || null;
    }
    return ok({ invite: { token: invite.token, role: invite.role, email: invite.email, expiresAt: invite.expires_at, url }, emailed, emailError });
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
    if (userId) {
      await removeMember(orgId, (role as Role) || 'member', userId);
      await (await import('@/lib/server/crm-store')).releaseAgentOf(orgId, String(userId)).catch(() => {});
    }
    return ok();
  } catch (e: any) {
    if (/dueño/.test(String(e?.message))) return fail(e.message, 400);
    return failFrom(e);
  }
}
