import { NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/server/tenant';
import { requireManager } from '@/lib/server/integrations-api';
import { oauthAvailable, oauthUrl, signState } from '@/lib/server/meta-ads';
import { SOCIAL_SCOPES } from '@/lib/server/social';
import { publicBaseUrl } from '@/lib/server/vapi';

export const dynamic = 'force-dynamic';

// "Conectar páginas": Facebook asks the owner to allow answering comments and sending private messages.
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${publicBaseUrl(req.nextUrl.origin)}/automations?social=${q}#comentarios`);
  try {
    const orgId = await requireManager();
    if (!oauthAvailable()) return back('not_available');
    const redirect = `${publicBaseUrl(req.nextUrl.origin)}/api/integrations/meta-pages/oauth/callback`;
    return NextResponse.redirect(oauthUrl(redirect, signState(orgId, sessionUserId()!), SOCIAL_SCOPES));
  } catch {
    return back('forbidden');
  }
}
