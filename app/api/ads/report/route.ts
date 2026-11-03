import { NextRequest } from 'next/server';
import { currentOrgId } from '@/lib/server/tenant';
import { adsConfig } from '@/lib/server/integrations';
import { AdsError } from '@/lib/server/meta-ads';
import { buildAdsReport, rangeFromQuery } from '@/lib/server/ads-report';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Creatives: spend from Meta + chats, orders and confirmed sales from Konnexa. ?range=today|yesterday|7d|14d|30d|90d|month|lastmonth|custom (&since&until)
export async function GET(req: NextRequest) {
  try {
    await currentOrgId();
    const { range, ...dates } = rangeFromQuery(req.nextUrl.searchParams);
    const cfg = await adsConfig();
    if (!cfg || !cfg.accountId) return ok({ connected: false, pending: Boolean(cfg && !cfg.accountId) });
    const report = await buildAdsReport(cfg, range, dates);
    return ok({ connected: true, account: { id: cfg.accountId, name: cfg.accountName, currency: cfg.currency, expiresAt: cfg.expiresAt }, report });
  } catch (e: any) {
    if (e instanceof AdsError) return fail(e.message, e.expired ? 401 : 502, { expired: e.expired });
    return failFrom(e);
  }
}
