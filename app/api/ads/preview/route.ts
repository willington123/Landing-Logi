import { NextRequest } from 'next/server';
import { currentOrgId } from '@/lib/server/tenant';
import { adsConfig } from '@/lib/server/integrations';
import { AdsError, PREVIEW_FORMATS, adPreview, type PreviewFormat } from '@/lib/server/meta-ads';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Preview of one ad as Meta shows it. ?adId=&format=MOBILE_FEED_STANDARD|INSTAGRAM_STANDARD|INSTAGRAM_STORY
export async function GET(req: NextRequest) {
  try {
    await currentOrgId();
    const cfg = await adsConfig();
    if (!cfg?.accountId) return fail('Conecta Meta Ads en Integraciones.', 400);
    const p = req.nextUrl.searchParams;
    const format = (PREVIEW_FORMATS as readonly string[]).includes(p.get('format') || '') ? (p.get('format') as PreviewFormat) : 'MOBILE_FEED_STANDARD';
    return ok({ ...(await adPreview(cfg, String(p.get('adId') || ''), format)) });
  } catch (e: any) {
    if (e instanceof AdsError) return fail(e.message, e.expired ? 401 : 400);
    return failFrom(e);
  }
}
