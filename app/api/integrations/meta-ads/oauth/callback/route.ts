import { NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/server/tenant';
import { seal, updateIntegrations } from '@/lib/server/integrations';
import { requireManager } from '@/lib/server/integrations-api';
import { checkState, exchangeCode, forgetAdsCache, listAdAccounts } from '@/lib/server/meta-ads';
import { publicBaseUrl } from '@/lib/server/vapi';

export const dynamic = 'force-dynamic';

// Back from Facebook: saves the token (encrypted). If there is a single ad account it is chosen right away.
export async function GET(req: NextRequest) {
  const base = publicBaseUrl(req.nextUrl.origin);
  const back = (q: string) => NextResponse.redirect(`${base}/integrations?ads=${q}`);
  try {
    const orgId = await requireManager();
    const p = req.nextUrl.searchParams;
    if (p.get('error')) return back('cancelled');
    if (!checkState(p.get('state'), orgId, sessionUserId()!)) return back('invalid');
    const code = p.get('code');
    if (!code) return back('cancelled');
    const { token, expiresAt } = await exchangeCode(code, `${base}/api/integrations/meta-ads/oauth/callback`);
    const accounts = await listAdAccounts(token).catch(() => []);
    const only = accounts.length === 1 ? accounts[0] : null;
    await updateIntegrations((s) => ({
      ...s,
      metaAds: { token: seal(token), accountId: only?.id || null, accountName: only?.name || null, currency: only?.currency || null, mode: 'oauth', expiresAt, connectedAt: new Date().toISOString() },
    }));
    forgetAdsCache();
    return back(only ? 'connected' : 'choose');
  } catch (e) {
    console.error('Meta Ads OAuth', e);
    return back('error');
  }
}
