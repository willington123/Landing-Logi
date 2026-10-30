import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, cloudConfigured, expectedToken, safeEqual } from '@/lib/auth';
import { checkPassword, clearFailures, countUsers, findUserByEmail, noteFailure, normalizeEmail, tooManyAttempts, userOrgs, withSession } from '@/lib/server/accounts';
import { fail, failFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const LAST_ORG = 'lp_last_org';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Small delay makes password guessing slower.
  await new Promise((r) => setTimeout(r, 300));

  // Local demo without a database: the single panel password.
  if (!cloudConfigured()) {
    const pw = (process.env.ADMIN_PASSWORD || '').trim();
    if (!pw) return NextResponse.json({ success: true });
    if (!safeEqual(String(body.password || ''), pw)) return fail('Contraseña incorrecta.', 401);
    const res = NextResponse.json({ success: true });
    res.cookies.set(AUTH_COOKIE, await expectedToken(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  try {
    if ((await countUsers()) === 0) return fail('Primero crea la cuenta del dueño.', 409, { needsSetup: true });
    const email = normalizeEmail(body.email);
    if (tooManyAttempts(email)) return fail('Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.', 429);
    const user = email ? await findUserByEmail(email) : null;
    if (!user || !(await checkPassword(String(body.password || ''), user.password_hash))) {
      noteFailure(email);
      return fail('Correo o contraseña incorrectos.', 401);
    }
    clearFailures(email);
    const orgs = await userOrgs(user.id);
    if (!orgs.length) return fail('Tu usuario no pertenece a ninguna tienda. Pide una nueva invitación.', 403);
    const last = req.cookies.get(LAST_ORG)?.value;
    const org = orgs.find((o) => o.id === last) || orgs[0];
    return withSession(NextResponse.json({ success: true, org: { id: org.id, name: org.name } }), user, org.id);
  } catch (e) {
    return failFrom(e);
  }
}
