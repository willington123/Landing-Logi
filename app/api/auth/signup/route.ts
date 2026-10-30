import { NextRequest, NextResponse } from 'next/server';
import { cloudConfigured } from '@/lib/auth';
import { addMember, countUsers, createOrg, createUser, normalizeEmail, passwordProblem, signupOpen, validEmail, withSession } from '@/lib/server/accounts';
import { fail, failFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Public when SIGNUP_OPEN=true: a new store (account) with its owner.
export async function POST(req: NextRequest) {
  if (!cloudConfigured()) return fail('La base de datos no está configurada.', 503);
  if (!signupOpen()) return fail('El registro no está abierto. Pide una invitación.', 403);
  const body = await req.json().catch(() => ({}));
  await new Promise((r) => setTimeout(r, 300));
  try {
    if ((await countUsers()) === 0) return fail('Primero hay que crear la cuenta del dueño de la plataforma.', 409);
    const email = normalizeEmail(body.email);
    const name = String(body.name || '').trim();
    const storeName = String(body.storeName || '').trim();
    if (!name) return fail('Escribe tu nombre.');
    if (!storeName) return fail('Escribe el nombre de tu tienda.');
    if (!validEmail(email)) return fail('Escribe un correo válido.');
    const problem = passwordProblem(body.password);
    if (problem) return fail(problem);
    const user = await createUser({ email, name, password: String(body.password) });
    const orgId = await createOrg(storeName);
    await addMember(orgId, user.id, 'owner');
    return withSession(NextResponse.json({ success: true }), user, orgId);
  } catch (e) {
    return failFrom(e);
  }
}
