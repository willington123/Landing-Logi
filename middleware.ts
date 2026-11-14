import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, SESSION_COOKIE, cloudConfigured, expectedToken, safeEqual, verifySession } from '@/lib/auth';

// Public: landing pages, their order endpoint, webhooks (WhatsApp, Vapi), the cron endpoint (each checks its own secret),
// sign-in / sign-up / invitations and static assets.
const PUBLIC_PREFIXES = [
  '/p/',
  '/muestra/',
  '/landing-styles/',
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

const SESSION_HEADERS = ['x-lp-org', 'x-lp-uid', 'x-lp-sv', 'x-lp-path', 'x-kx-domain-org'];

// ---------- a store's own domain (ofertas.mitienda.com → its landings) ----------

const MAIN_HOSTS = (() => {
  const out = new Set(['konnexa.lat', 'www.konnexa.lat', 'localhost', '127.0.0.1']);
  try {
    const base = (process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
    if (base) out.add(new URL(base).hostname.toLowerCase());
  } catch {}
  return out;
})();
let domainCache: { map: Record<string, { org: string; landing: string | null }>; until: number } | null = null;
async function domainMap(): Promise<Record<string, { org: string; landing: string | null }>> {
  if (domainCache && domainCache.until > Date.now()) return domainCache.map;
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const secret = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  let map: Record<string, { org: string; landing: string | null }> = {};
  if (url && secret) {
    try {
      const r = await fetch(`${url}/rest/v1/platform_settings?select=data&id=eq.domains&limit=1`, {
        headers: { apikey: secret, ...(secret.startsWith('sb_') ? {} : { Authorization: `Bearer ${secret}` }) },
        cache: 'no-store',
      });
      const rows = r.ok ? ((await r.json()) as { data: typeof map }[]) : [];
      map = rows[0]?.data || {};
    } catch {
      map = domainCache?.map || {};
    }
  }
  domainCache = { map, until: Date.now() + 60_000 };
  return map;
}

// On a store's domain only its landings open: / (the chosen landing), /<slug> and /p/<slug>. The order form,
// the app's files and Meta's verification file pass; anything else goes to Konnexa's main site.
async function customDomain(req: NextRequest, headers: Headers): Promise<NextResponse | null> {
  const host = (req.headers.get('host') || req.nextUrl.hostname || '').toLowerCase().replace(/:\d+$/, '');
  if (!host || MAIN_HOSTS.has(host) || host.endsWith('.vercel.app')) return null;
  const entry = (await domainMap())[host];
  if (!entry) return null;
  const path = req.nextUrl.pathname;
  if (path.startsWith('/_next/') || path.startsWith('/api/public/') || /\.[a-z0-9]{2,5}$/i.test(path)) return NextResponse.next({ request: { headers } });
  const m = /^\/(?:p\/)?([a-z0-9-]{1,120})\/?$/i.exec(path);
  const slug = path === '/' ? entry.landing : m ? m[1] : null;
  if (path !== '/' && !m) {
    const to = new URL(`https://konnexa.lat${path}${req.nextUrl.search}`);
    return NextResponse.redirect(to);
  }
  const url = req.nextUrl.clone();
  url.pathname = `/p/${slug || '__sin-landing__'}`;
  headers.set('x-kx-domain-org', entry.org);
  return NextResponse.rewrite(url, { request: { headers } });
}

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
  if (cloudConfigured()) {
    const own = await customDomain(req, headers);
    if (own) return own;
  }
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
