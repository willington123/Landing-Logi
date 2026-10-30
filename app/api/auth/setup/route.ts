import { NextRequest, NextResponse } from 'next/server';
import { cloudConfigured, safeEqual } from '@/lib/auth';
import { MAIN_ORG, addMember, countUsers, createUser, normalizeEmail, passwordProblem, renameOrg, validEmail, withSession } from '@/lib/server/accounts';
import { rawDb } from '@/lib/server/supabase';
import { fail, failFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Public, only while there are no users: creates the owner of the existing store (all current data).
// Proves ownership with the old panel password (ADMIN_PASSWORD).
export async function POST(req: NextRequest) {
  if (!cloudConfigured()) return fail('La base de datos no está configurada.', 503);
  const body = await req.json().catch(() => ({}));
  await new Promise((r) => setTimeout(r, 300));
  try {
    if ((await countUsers()) > 0) return fail('La cuenta del dueño ya existe. Inicia sesión.', 409);
    const adminPw = (process.env.ADMIN_PASSWORD || '').trim();
    if (!adminPw) return fail('Para crear la cuenta del dueño, agrega ADMIN_PASSWORD en Vercel (y Redeploy) y escríbela aquí.', 400);
    if (!safeEqual(String(body.adminPassword || ''), adminPw)) return fail('La contraseña actual del panel no es correcta.', 401);
    const email = normalizeEmail(body.email);
    const name = String(body.name || '').trim();
    if (!name) return fail('Escribe tu nombre.');
    if (!validEmail(email)) return fail('Escribe un correo válido.');
    const problem = passwordProblem(body.password);
    if (problem) return fail(problem);

    const user = await createUser({ email, name, password: String(body.password) });
    // The store name: what was typed, or the one already saved in Configuración.
    let storeName = String(body.storeName || '').trim();
    if (!storeName) {
      const { data } = await rawDb().from('settings').select('data').eq('org_id', MAIN_ORG).eq('id', 'default').maybeSingle();
      storeName = String((data?.data as any)?.storeName || '').trim();
    }
    if (storeName) await renameOrg(MAIN_ORG, storeName);
    await addMember(MAIN_ORG, user.id, 'owner');
    return withSession(NextResponse.json({ success: true }), user, MAIN_ORG);
  } catch (e) {
    return failFrom(e);
  }
}
