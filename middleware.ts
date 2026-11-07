import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, SESSION_COOKIE, cloudConfigured, expectedToken, safeEqual, verifySession } from '@/lib/auth';

// Public: landing pages, their order endpoint, webhooks (WhatsApp, Vapi), the cron endpoint (each checks its own secret),
// sign-in / sign-up / invitations and static assets.
const PUBLIC_PREFIXES = [
  '/p/',
  '/citas/',
  '/api/public/',
  '/api/whatsapp/webhook',
  '/api/meta/webhook',
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
  '/manifest.webmanifest',
  '/sw.js',
  '/pwa/',
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

// Membership check for a store named in the request (cached briefly: the inbox asks every few seconds).
const memberCache = new Map<string, { ok: boolean; until: number }>();
async function isMember(uid: string, org: string): Promise<boolean> {
  if (!/^[\w-]{1,64}$/.test(org)) return false;
  const key = `${uid}|${org}`;
  const hit = memberCache.get(key);
  if (hit && hit.until > Date.now()) return hit.ok;
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const secret = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !secret) return false;
  try {
    const r = await fetch(`${url}/rest/v1/memberships?select=role&org_id=eq.${encodeURIComponent(org)}&user_id=eq.${encodeURIComponent(uid)}&limit=1`, {
      headers: { apikey: secret, ...(secret.startsWith('sb_') ? {} : { Authorization: `Bearer ${secret}` }) },
      cache: 'no-store',
    });
    const ok = r.ok && ((await r.json()) as unknown[]).length > 0;
    if (memberCache.size > 2000) memberCache.clear();
    memberCache.set(key, { ok, until: Date.now() + 30_000 });
    return ok;
  } catch {
    return false;
  }
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
  // One inbox for several stores: an API request may name another store of the same person (header, or ?kxorg=
  // for photos and audio loaded by the browser). Only used after checking the person belongs to that store.
  const asked = req.headers.get('x-kx-org') || req.nextUrl.searchParams.get('kxorg') || '';
  let org = session.o;
  if (asked && asked !== session.o && req.nextUrl.pathname.startsWith('/api/')) {
    if (!(await isMember(session.u, asked))) return NextResponse.json({ success: false, error: 'No perteneces a esa tienda.' }, { status: 403 });
    org = asked;
  }
  headers.set('x-lp-org', org);
  headers.set('x-lp-uid', session.u);
  headers.set('x-lp-sv', String(session.v));
  headers.set('x-lp-path', req.nextUrl.pathname);
  return pass();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
