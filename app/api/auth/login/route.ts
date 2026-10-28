import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, authEnabled, expectedToken, safeEqual } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!authEnabled()) return NextResponse.json({ success: true });
  const { password } = await req.json().catch(() => ({ password: '' }));
  // Small delay makes password guessing slower.
  await new Promise((r) => setTimeout(r, 400));
  if (!safeEqual(String(password || ''), process.env.ADMIN_PASSWORD!.trim())) {
    return NextResponse.json({ success: false, error: 'Contraseña incorrecta.' }, { status: 401 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE, await expectedToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
