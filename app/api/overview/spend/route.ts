import { NextRequest } from 'next/server';
import { roleIn } from '@/lib/server/accounts';
import { currentOrgId, sessionUserId } from '@/lib/server/tenant';
import { adsConfig } from '@/lib/server/integrations';
import { accountSpend } from '@/lib/server/meta-ads';
import { AD_RANGES, rangeDates, type AdRange } from '@/lib/server/ads-report';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Ad spend of one of the person's stores (all its ad accounts). ?org=&range=
export async function GET(req: NextRequest) {
  try {
    await currentOrgId();
    const org = String(req.nextUrl.searchParams.get('org') || '');
    if (!(await roleIn(org, sessionUserId()!))) return fail('No perteneces a esa tienda.', 403);
    const range = (AD_RANGES as string[]).includes(req.nextUrl.searchParams.get('range') || '') ? (req.nextUrl.searchParams.get('range') as AdRange) : '7d';
    const cfg = await adsConfig(org);
    if (!cfg?.accounts.length) return ok({ connected: false });
    const { since, until } = rangeDates(range);
    let spend = 0;
    let other = 0; // spend in non-COP accounts (not added to COP)
    const errors: string[] = [];
    await Promise.all(
      cfg.accounts.map(async (a) => {
        try {
          const v = await accountSpend(cfg, a.id, since, until);
          if (!a.currency || a.currency.toUpperCase() === 'COP') spend += v;
          else other += v;
        } catch (e: any) {
          errors.push(`${a.name || a.id}: ${e?.message || e}`);
        }
      }),
    );
    return ok({ connected: true, spend, otherCurrency: other > 0, errors });
  } catch (e) {
    return failFrom(e);
  }
}
