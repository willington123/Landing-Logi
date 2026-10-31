// "Creativos": Meta spend per ad joined with what Konnexa knows (chats from the ad, orders, confirmed sales).
import { db } from '@/lib/server/db';
import { getConversationAds } from '@/lib/server/crm-store';
import { adCreatives, adInsights } from '@/lib/server/meta-ads';
import type { AdsConfig } from '@/lib/server/integrations';
import type { OrderItem } from '@/lib/types';

export type AdRange = 'today' | '7d' | '30d' | 'month';
export const AD_RANGES: AdRange[] = ['today', '7d', '30d', 'month'];

const TZ = 'America/Bogota';
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

// Days in Colombia time (what Meta uses for COP accounts) and the matching instants for orders.
export function rangeDates(range: AdRange, now = new Date()) {
  const until = ymd(now);
  let since = until;
  if (range === '7d') since = ymd(new Date(now.getTime() - 6 * 86400000));
  if (range === '30d') since = ymd(new Date(now.getTime() - 29 * 86400000));
  if (range === 'month') since = `${until.slice(0, 8)}01`;
  return { since, until, fromIso: new Date(`${since}T00:00:00-05:00`).toISOString(), toIso: new Date(`${until}T23:59:59.999-05:00`).toISOString() };
}

const CONFIRMED = new Set(['confirmed_by_voice', 'shipped', 'delivered']);

export type AdFlag = 'winner' | 'waste' | 'cancels';

export interface AdRow {
  adId: string;
  name: string;
  campaign: string;
  status: string | null;
  thumb: string | null;
  kind: 'video' | 'image' | 'other' | null;
  spend: number;
  impressions: number;
  clicks: number;
  chats: number; // chats Konnexa received from this ad
  metaChats: number; // conversations Meta counted
  orders: number;
  confirmed: number;
  cancelled: number;
  revenue: number; // confirmed sales
  cpa: number | null; // spend / confirmed
  roas: number | null; // revenue / spend
  flags: AdFlag[];
}

export interface AdsReport {
  range: AdRange;
  since: string;
  until: string;
  currency: string | null;
  sameCurrency: boolean; // ROAS only makes sense if the ad account bills in COP
  rows: AdRow[];
  totals: { spend: number; orders: number; confirmed: number; cancelled: number; revenue: number; chats: number; cpa: number | null; roas: number | null };
  unattributed: number; // orders in the range without an ad id (links without utm_content={{ad.id}})
  wasteMin: number; // spend that counts as "gastó sin vender"
  creativesError: string | null; // why thumbnails could not be read
}

export async function buildAdsReport(cfg: AdsConfig, range: AdRange): Promise<AdsReport> {
  const { since, until, fromIso, toIso } = rangeDates(range);
  const [insights, ordersRes, chatAds] = await Promise.all([
    adInsights(cfg, since, until),
    (await db()).from('orders').select('data, status').gte('created_at', fromIso).lte('created_at', toIso).limit(10000),
    getConversationAds().catch(() => ({}) as Record<string, { id: string; at: string }>),
  ]);
  if (ordersRes.error) throw new Error(ordersRes.error.message);
  const orders = (ordersRes.data || []).map((r: any) => ({ ...(r.data as OrderItem), status: r.status || r.data?.status }));

  const rows = new Map<string, AdRow>();
  const row = (adId: string): AdRow => {
    let r = rows.get(adId);
    if (!r) {
      r = { adId, name: '', campaign: '', status: null, thumb: null, kind: null, spend: 0, impressions: 0, clicks: 0, chats: 0, metaChats: 0, orders: 0, confirmed: 0, cancelled: 0, revenue: 0, cpa: null, roas: null, flags: [] };
      rows.set(adId, r);
    }
    return r;
  };
  for (const i of insights) {
    const r = row(i.adId);
    r.name = i.adName;
    r.campaign = i.campaignName;
    r.spend += i.spend;
    r.impressions += i.impressions;
    r.clicks += i.clicks;
    r.metaChats += i.metaChats;
  }
  let unattributed = 0;
  for (const o of orders) {
    if (!o.adId) {
      unattributed++;
      continue;
    }
    const r = row(o.adId);
    if (!r.name && o.adHeadline) r.name = o.adHeadline;
    r.orders++;
    if (CONFIRMED.has(o.status)) {
      r.confirmed++;
      r.revenue += Number(o.totalAmount) || 0;
    }
    if (o.status === 'cancelled') r.cancelled++;
  }
  for (const a of Object.values(chatAds)) {
    if (a?.id && a.at >= fromIso && a.at <= toIso) row(a.id).chats++;
  }

  const { creatives, error: creativesError } = await adCreatives(cfg, Array.from(rows.keys())).catch((e) => ({ creatives: {} as Awaited<ReturnType<typeof adCreatives>>['creatives'], error: String(e?.message || e) }));
  for (const r of Array.from(rows.values())) {
    const c = creatives[r.adId];
    if (c) {
      r.name = r.name || c.name;
      r.status = c.status || null;
      r.thumb = c.thumb;
      r.kind = c.kind;
    }
    if (!r.name) r.name = `Anuncio ${r.adId}`;
  }

  const sameCurrency = !cfg.currency || cfg.currency.toUpperCase() === 'COP';
  const list = Array.from(rows.values());
  const t = list.reduce(
    (a, r) => ({ spend: a.spend + r.spend, orders: a.orders + r.orders, confirmed: a.confirmed + r.confirmed, cancelled: a.cancelled + r.cancelled, revenue: a.revenue + r.revenue, chats: a.chats + r.chats }),
    { spend: 0, orders: 0, confirmed: 0, cancelled: 0, revenue: 0, chats: 0 },
  );
  const totals = { ...t, cpa: t.confirmed ? t.spend / t.confirmed : null, roas: sameCurrency && t.spend ? t.revenue / t.spend : null };

  // "Gastó sin vender": already spent what a confirmed sale usually costs in this account (or 30.000 COP / 10 USD) with no sale.
  const wasteMin = Math.max(totals.cpa || 0, sameCurrency ? 30000 : 10);
  for (const r of list) {
    r.cpa = r.confirmed && r.spend > 0 ? r.spend / r.confirmed : null;
    r.roas = sameCurrency && r.spend > 0 ? r.revenue / r.spend : null;
    if (r.confirmed === 0 && r.spend >= wasteMin) r.flags.push('waste');
    if (r.orders >= 3 && r.cancelled / r.orders >= 0.4) r.flags.push('cancels');
  }
  // Winners: the 3 ads with most confirmed sales that also beat the account's ROAS (or, without spend data, sell the most).
  list
    .filter((r) => r.confirmed >= 2 && r.spend > 0 && (r.roas === null || totals.roas === null || r.roas >= Math.max(1, totals.roas)))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
    .forEach((r) => r.flags.push('winner'));

  list.sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
  return { range, since, until, currency: cfg.currency, sameCurrency, rows: list, totals, unattributed, wasteMin, creativesError: rows.size && !Object.keys(creatives).length ? creativesError : null };
}
