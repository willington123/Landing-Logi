import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, cloudConfigured, verifySession } from '@/lib/auth';
import {
  checkPassword,
  clearFailures,
  createUser,
  findUserByEmail,
  getInvite,
  getUser,
  noteFailure,
  normalizeEmail,
  passwordProblem,
  tooManyAttempts,
  useInvite,
  validEmail,
  withSession,
} from '@/lib/server/accounts';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const ROLE_LABEL = { owner: 'dueño', admin: 'administrador', member: 'miembro del equipo' } as const;

// Public: details of an invitation link.
export async function GET(req: NextRequest) {
  if (!cloudConfigured()) return fail('La base de datos no está configurada.', 503);
  try {
    const invite = await getInvite(req.nextUrl.searchParams.get('token') || '');
    if (!invite) return fail('Esta invitación no existe, ya se usó o venció. Pide una nueva.', 404);
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    const me = session ? await getUser(session.u) : null;
    return ok({ orgName: invite.orgName, role: invite.role, roleLabel: ROLE_LABEL[invite.role], email: invite.email, signedInAs: me?.email || null });
  } catch (e) {
    return failFrom(e);
  }
}

// Accept: { token, mode: 'session' | 'new' | 'login', name?, email?, password? }.
export async function POST(req: NextRequest) {
  if (!cloudConfigured()) return fail('La base de datos no está configurada.', 503);
  const body = await req.json().catch(() => ({}));
  try {
    const invite = await getInvite(String(body.token || ''));
    if (!invite) return fail('Esta invitación no existe, ya se usó o venció. Pide una nueva.', 404);

    let user;
    if (body.mode === 'session') {
      const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
      user = session ? await getUser(session.u) : null;
      if (!user || (user.session_version || 1) !== session!.v) return fail('Tu sesión venció. Inicia sesión para aceptar.', 401);
      if (invite.email && user.email !== invite.email) return fail(`Esta invitación es para ${invite.email}. Entra con ese correo.`, 403);
    } else {
      await new Promise((r) => setTimeout(r, 300));
      const email = normalizeEmail(invite.email || body.email);
      if (!validEmail(email)) return fail('Escribe un correo válido.');
      if (body.mode === 'new') {
        const name = String(body.name || '').trim();
        if (!name) return fail('Escribe tu nombre.');
        const problem = passwordProblem(body.password);
        if (problem) return fail(problem);
        user = await createUser({ email, name, password: String(body.password) });
      } else {
        if (tooManyAttempts(email)) return fail('Demasiados intentos. Espera 15 minutos.', 429);
        const found = await findUserByEmail(email);
        if (!found || !(await checkPassword(String(body.password || ''), found.password_hash))) {
          noteFailure(email);
          return fail('Correo o contraseña incorrectos.', 401);
        }
        clearFailures(email);
        user = found;
      }
    }
    await useInvite(invite, user.id);
    return withSession(NextResponse.json({ success: true }), user, invite.org_id);
  } catch (e) {
    return failFrom(e);
  }
}
