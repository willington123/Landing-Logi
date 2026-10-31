import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, SESSION_COOKIE, cloudConfigured, expectedToken, safeEqual, verifySession } from '@/lib/auth';

// Public: landing pages, their order endpoint, webhooks (WhatsApp, Vapi), the cron endpoint (each checks its own secret),
// sign-in / sign-up / invitations and static assets.
const PUBLIC_PREFIXES = [
  '/p/',
  '/api/public/',
  '/api/whatsapp/webhook',
  '/api/vapi/webhook',
  '/api/cron/',
  '/api/billing/wompi/webhook',
  '/api/auth/',
  '/login',
  '/registro',
  '/invitacion/',
  '/privacidad',
  '/terminos',
  '/recuperar',
  '/restablecer',
  '/_next/',
  '/brand/',
  '/favicon',
  '/icon',
  '/apple-icon',
];

const SESSION_HEADERS = ['x-lp-org', 'x-lp-uid', 'x-lp-sv', 'x-lp-path'];

function deny(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'No autorizado. Inicia sesión en el panel.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  // Never trust session headers sent by the browser.
  const headers = new Headers(req.headers);
  SESSION_HEADERS.forEach((h) => headers.delete(h));
  const pass = () => NextResponse.next({ request: { headers } });
  const isPublic = req.nextUrl.pathname === '/' || PUBLIC_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p)); // '/' = sales page

  // Local demo without a database: optional single password.
  if (!cloudConfigured()) {
    if (!process.env.ADMIN_PASSWORD?.trim() || isPublic) return pass();
    const cookie = req.cookies.get(AUTH_COOKIE)?.value || '';
    return cookie && safeEqual(cookie, await expectedToken()) ? pass() : deny(req);
  }

  if (isPublic) return pass();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return deny(req);
  headers.set('x-lp-org', session.o);
  headers.set('x-lp-uid', session.u);
  headers.set('x-lp-sv', String(session.v));
  headers.set('x-lp-path', req.nextUrl.pathname);
  return pass();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
