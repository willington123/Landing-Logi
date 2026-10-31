import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { cloudConfigured } from '@/lib/auth';
import { findUserByEmail, normalizeEmail, validEmail } from '@/lib/server/accounts';
import { emailConfigured } from '@/lib/server/email';
import { resetToken } from '@/lib/server/password-reset';
import { sendPasswordReset } from '@/lib/server/notify';
import { publicBaseUrl } from '@/lib/server/vapi';
import { fail, failFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// At most 3 emails per address every 15 minutes (per server instance).
const recent = new Map<string, number[]>();
function limited(email: string) {
  const now = Date.now();
  const hits = (recent.get(email) || []).filter((t) => now - t < 15 * 60000);
  if (hits.length >= 3) return true;
  recent.set(email, [...hits, now]);
  return false;
}

// "Olvidé mi contraseña". Body: { email }. Always answers the same, so nobody can learn which emails have an account.
export async function POST(req: NextRequest) {
  if (!cloudConfigured()) return fail('La base de datos no está configurada.', 503);
  if (!emailConfigured()) return fail('El envío de correos aún no está activo. Pídele al administrador de la plataforma un enlace para cambiar tu contraseña.', 503);
  const { email: raw } = await req.json().catch(() => ({}));
  const email = normalizeEmail(raw);
  if (!validEmail(email)) return fail('Escribe un correo válido.');
  await new Promise((r) => setTimeout(r, 300));
  try {
    if (!limited(email)) {
      const user = await findUserByEmail(email);
      if (user) {
        const url = `${publicBaseUrl(req.nextUrl.origin)}/restablecer?t=${encodeURIComponent(resetToken(user))}`;
        waitUntil(sendPasswordReset({ email: user.email, name: user.name, url }).catch(() => {}));
      }
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return failFrom(e);
  }
}
