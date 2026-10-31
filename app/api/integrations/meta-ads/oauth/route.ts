import { NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/server/tenant';
import { requireManager } from '@/lib/server/integrations-api';
import { oauthAvailable, oauthUrl, signState } from '@/lib/server/meta-ads';
import { publicBaseUrl } from '@/lib/server/vapi';

export const dynamic = 'force-dynamic';

// "Conectar con Facebook" for Meta Ads: sends the owner to Facebook to allow read-only access (ads_read).
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${publicBaseUrl(req.nextUrl.origin)}/integrations?ads=${q}`);
  try {
    const orgId = await requireManager();
    if (!oauthAvailable()) return back('not_available');
    const redirect = `${publicBaseUrl(req.nextUrl.origin)}/api/integrations/meta-ads/oauth/callback`;
    return NextResponse.redirect(oauthUrl(redirect, signState(orgId, sessionUserId()!)));
  } catch {
    return back('forbidden');
  }
}
