import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, authEnabled, expectedToken, safeEqual } from '@/lib/auth';

// Public: landing pages, their order endpoint, the WhatsApp webhook (signed by Meta), the login flow and static assets.
const PUBLIC_PREFIXES = ['/p/', '/api/public/', '/api/whatsapp/webhook', '/api/auth/', '/login', '/_next/', '/brand/', '/favicon', '/icon', '/apple-icon'];

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value || '';
  if (cookie && safeEqual(cookie, await expectedToken())) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'No autorizado. Inicia sesión en el panel.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
