import { NextRequest } from 'next/server';
import { currentOrgId } from '@/lib/server/tenant';
import { adsConfig } from '@/lib/server/integrations';
import { AdsError } from '@/lib/server/meta-ads';
import { AD_RANGES, buildAdsReport, type AdRange } from '@/lib/server/ads-report';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Creatives: spend from Meta + chats, orders and confirmed sales from Konnexa. ?range=today|7d|30d|month
export async function GET(req: NextRequest) {
  try {
    await currentOrgId();
    const range = (AD_RANGES as string[]).includes(req.nextUrl.searchParams.get('range') || '') ? (req.nextUrl.searchParams.get('range') as AdRange) : '7d';
    const cfg = await adsConfig();
    if (!cfg || !cfg.accountId) return ok({ connected: false, pending: Boolean(cfg && !cfg.accountId) });
    const report = await buildAdsReport(cfg, range);
    return ok({ connected: true, account: { id: cfg.accountId, name: cfg.accountName, currency: cfg.currency, expiresAt: cfg.expiresAt }, report });
  } catch (e: any) {
    if (e instanceof AdsError) return fail(e.message, e.expired ? 401 : 502, { expired: e.expired });
    return failFrom(e);
  }
}
