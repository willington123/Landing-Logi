import { NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/server/tenant';
import { requireManager } from '@/lib/server/integrations-api';
import { checkState, exchangeCode } from '@/lib/server/meta-ads';
import { listPages, savePages } from '@/lib/server/social';
import { publicBaseUrl } from '@/lib/server/vapi';

export const dynamic = 'force-dynamic';

// Back from Facebook: keeps the store's pages (and their Instagram accounts) with their page tokens (encrypted).
export async function GET(req: NextRequest) {
  const base = publicBaseUrl(req.nextUrl.origin);
  const back = (q: string) => NextResponse.redirect(`${base}/automations?social=${q}#comentarios`);
  try {
    const orgId = await requireManager();
    const p = req.nextUrl.searchParams;
    if (p.get('error')) return back('cancelled');
    if (!checkState(p.get('state'), orgId, sessionUserId()!)) return back('invalid');
    const code = p.get('code');
    if (!code) return back('cancelled');
    const { token } = await exchangeCode(code, `${base}/api/integrations/meta-pages/oauth/callback`);
    const pages = await listPages(token);
    if (!pages.length) return back('no_pages');
    await savePages(pages);
    return back('connected');
  } catch (e) {
    console.error('Páginas de Facebook OAuth', e);
    return back('error');
  }
}
