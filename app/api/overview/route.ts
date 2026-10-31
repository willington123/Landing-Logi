import { NextRequest } from 'next/server';
import { rawDb } from '@/lib/server/supabase';
import { userOrgs } from '@/lib/server/accounts';
import { currentOrgId, integrationsOrg, sessionUserId } from '@/lib/server/tenant';
import { computeSub, getPlans, type SubRow } from '@/lib/server/billing';
import { AD_RANGES, rangeDates, type AdRange } from '@/lib/server/ads-report';
import { failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CONFIRMED = new Set(['confirmed_by_voice', 'shipped', 'delivered']);
const env = (k: string) => (process.env[k] || '').trim();

// "Mis tiendas": one row per store the person belongs to, with orders and sales of the period.
// Ad spend is loaded per store afterwards (/api/overview/spend) so the page doesn't wait for Meta.
export async function GET(req: NextRequest) {
  try {
    await currentOrgId();
    const uid = sessionUserId()!;
    const range = (AD_RANGES as string[]).includes(req.nextUrl.searchParams.get('range') || '') ? (req.nextUrl.searchParams.get('range') as AdRange) : '7d';
    const { fromIso, toIso, since, until } = rangeDates(range);
    const orgs = await userOrgs(uid);
    const ids = orgs.map((o) => o.id);
    if (!ids.length) return ok({ range, since, until, stores: [] });

    // Orders of the period, only the columns needed (paged: Supabase returns at most 1000 rows per request).
    const orders: { org_id: string; status: string; total: number | string | null; adId: string | null }[] = [];
    for (let from = 0; from < 100000; from += 1000) {
      const { data, error } = await rawDb()
        .from('orders')
        .select('org_id, status, total:data->totalAmount, adId:data->>adId')
        .in('org_id', ids)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true })
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      orders.push(...((data || []) as any[]));
      if (!data || data.length < 1000) break;
    }
    const [{ data: subs }, { data: sets }, plans] = await Promise.all([
      rawDb().from('subscriptions').select('*').in('org_id', ids),
      rawDb().from('settings').select('org_id, id, data').in('org_id', ids).in('id', ['integrations', 'wa_bot']),
      getPlans(),
    ]);
    const subBy = Object.fromEntries((subs || []).map((s) => [s.org_id, s as SubRow]));
    const setting = (org: string, id: string) => (sets || []).find((r) => r.org_id === org && r.id === id)?.data as any;

    const stores = orgs.map((o) => {
      const mine = orders.filter((x) => x.org_id === o.id);
      const confirmed = mine.filter((x) => CONFIRMED.has(x.status));
      const integ = setting(o.id, 'integrations') || {};
      const envWa = o.id === integrationsOrg() && Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'));
      const row = subBy[o.id];
      const sub = row ? computeSub(row, plans.find((p) => p.id === row.plan) || plans[1]) : null;
      return {
        id: o.id,
        name: o.name,
        role: o.role,
        plan: sub ? { status: sub.effective, daysLeft: sub.daysLeft } : null,
        whatsapp: Boolean(integ.whatsapp?.phoneNumberId) || envWa,
        whatsappPhone: integ.whatsapp?.displayPhone || null,
        assistant: Boolean(setting(o.id, 'wa_bot')?.enabled),
        ads: Boolean(integ.metaAds?.accountId || integ.metaAds?.accounts?.length),
        orders: mine.length,
        confirmed: confirmed.length,
        cancelled: mine.filter((x) => x.status === 'cancelled').length,
        revenue: confirmed.reduce((n, x) => n + (Number(x.total) || 0), 0),
        fromAds: mine.filter((x) => x.adId).length,
      };
    });
    return ok({ range, since, until, stores });
  } catch (e) {
    return failFrom(e);
  }
}
