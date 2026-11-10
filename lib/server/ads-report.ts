// "Creativos": Meta spend per ad joined with what Konnexa knows (chats from the ad, orders, confirmed sales).
import { db } from '@/lib/server/db';
import { getConversationAds } from '@/lib/server/crm-store';
import { adCreatives, adInsights } from '@/lib/server/meta-ads';
import type { AdsConfig } from '@/lib/server/integrations';
import type { OrderItem } from '@/lib/types';

export type AdRange = 'today' | 'yesterday' | '7d' | '14d' | '30d' | '90d' | 'month' | 'lastmonth' | 'custom';
export const AD_RANGES: AdRange[] = ['today', 'yesterday', '7d', '14d', '30d', '90d', 'month', 'lastmonth', 'custom'];
const MAX_DAYS = 400;

const TZ = 'America/Bogota';
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const DAY = 86400000;
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00-05:00`)) && ymd(new Date(`${v}T12:00:00-05:00`)) === v;

// Days in Colombia time (what Meta uses for COP accounts) and the matching instants for orders.
// "custom" uses the given days: never after today and at most MAX_DAYS long.
export function rangeDates(range: AdRange, now = new Date(), custom?: { since?: string | null; until?: string | null }) {
  const today = ymd(now);
  const ago = (n: number) => ymd(new Date(now.getTime() - n * DAY));
  let since = today;
  let until = today;
  if (range === 'yesterday') since = until = ago(1);
  if (range === '7d') since = ago(6);
  if (range === '14d') since = ago(13);
  if (range === '30d') since = ago(29);
  if (range === '90d') since = ago(89);
  if (range === 'month') since = `${today.slice(0, 8)}01`;
  if (range === 'lastmonth') {
    until = ymd(new Date(new Date(`${today.slice(0, 8)}01T12:00:00-05:00`).getTime() - DAY));
    since = `${until.slice(0, 8)}01`;
  }
  if (range === 'custom') {
    let a = isDay(custom?.since) ? custom!.since! : ago(6);
    let b = isDay(custom?.until) ? custom!.until! : today;
    if (b > today) b = today;
    if (a > b) [a, b] = [b, a];
    const minSince = ymd(new Date(new Date(`${b}T12:00:00-05:00`).getTime() - (MAX_DAYS - 1) * DAY));
    since = a < minSince ? minSince : a;
    until = b;
  }
  return { since, until, fromIso: new Date(`${since}T00:00:00-05:00`).toISOString(), toIso: new Date(`${until}T23:59:59.999-05:00`).toISOString() };
}

// ?range=…  (and &since=YYYY-MM-DD&until=YYYY-MM-DD when range=custom)
export function rangeFromQuery(q: URLSearchParams, fallback: AdRange = '7d') {
  const r = q.get('range') || '';
  const range = (AD_RANGES as string[]).includes(r) ? (r as AdRange) : fallback;
  return { range, ...rangeDates(range, new Date(), { since: q.get('since'), until: q.get('until') }) };
}

const CONFIRMED = new Set(['confirmed_by_voice', 'shipped', 'delivered', 'returned']);

export type AdFlag = 'winner' | 'waste' | 'cancels';

export interface AdRow {
  adId: string;
  accountId: string | null;
  accountName: string | null;
  currency: string | null; // of the ad account (null = ad only seen in orders/chats)
  name: string;
  campaign: string;
  adset: string;
  status: string | null;
  thumb: string | null;
  thumbs: string[];
  kind: 'video' | 'image' | 'other' | null;
  previewLink: string | null; // opens the real ad on Facebook
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
  sameCurrency: boolean; // every connected account bills in COP (otherwise totals only count COP accounts)
  accounts: { id: string; name: string | null; currency: string | null; error: string | null }[];
  rows: AdRow[];
  totals: { spend: number; orders: number; confirmed: number; cancelled: number; revenue: number; chats: number; cpa: number | null; roas: number | null };
  unattributed: number; // orders in the range without an ad id (links without utm_content={{ad.id}})
  wasteMin: number; // spend that counts as "gastó sin vender"
  creativesError: string | null; // why thumbnails could not be read
}

export async function buildAdsReport(cfg: AdsConfig, range: AdRange, dates = rangeDates(range)): Promise<AdsReport> {
  const { since, until, fromIso, toIso } = dates;
  const perAccount = await Promise.all(
    cfg.accounts.map(async (a) => {
      try {
        return { account: a, rows: await adInsights({ ...cfg, accountId: a.id }, since, until), error: null as string | null };
      } catch (e: any) {
        if (e?.expired) throw e;
        return { account: a, rows: [], error: String(e?.message || e) };
      }
    }),
  );
  const [ordersRes, chatAds] = await Promise.all([
    (await db()).from('orders').select('data, status').gte('created_at', fromIso).lte('created_at', toIso).limit(10000),
    getConversationAds().catch(() => ({}) as Record<string, { id: string; at: string }>),
  ]);
  if (ordersRes.error) throw new Error(ordersRes.error.message);
  const orders = (ordersRes.data || []).map((r: any) => ({ ...(r.data as OrderItem), status: r.status || r.data?.status }));

  const rows = new Map<string, AdRow>();
  const row = (adId: string): AdRow => {
    let r = rows.get(adId);
    if (!r) {
      r = { adId, accountId: null, accountName: null, currency: null, name: '', campaign: '', adset: '', status: null, thumb: null, thumbs: [], kind: null, previewLink: null, spend: 0, impressions: 0, clicks: 0, chats: 0, metaChats: 0, orders: 0, confirmed: 0, cancelled: 0, revenue: 0, cpa: null, roas: null, flags: [] };
      rows.set(adId, r);
    }
    return r;
  };
  for (const { account, rows: insights } of perAccount) {
    for (const i of insights) {
      const r = row(i.adId);
      r.accountId = account.id;
      r.accountName = account.name;
      r.currency = account.currency;
      r.name = i.adName;
      r.campaign = i.campaignName;
      r.adset = i.adsetName;
      r.spend += i.spend;
      r.impressions += i.impressions;
      r.clicks += i.clicks;
      r.metaChats += i.metaChats;
    }
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

  const creatives: Awaited<ReturnType<typeof adCreatives>>['creatives'] = {};
  let creativesError: string | null = null;
  const all = Array.from(rows.values());
  for (const a of cfg.accounts.length ? cfg.accounts : [{ id: cfg.accountId || '', name: null, currency: null }]) {
    // Ads only seen in orders or chats are looked up with the first account (the fallback reads them by id).
    const ids = all.filter((r) => r.accountId === a.id || (!r.accountId && a.id === cfg.accounts[0]?.id)).map((r) => r.adId);
    if (!ids.length) continue;
    const got = await adCreatives({ ...cfg, accountId: a.id }, ids).catch((e) => ({ creatives: {}, error: String(e?.message || e) }));
    Object.assign(creatives, got.creatives);
    creativesError = creativesError || got.error;
  }
  for (const r of Array.from(rows.values())) {
    const c = creatives[r.adId];
    if (c) {
      r.name = r.name || c.name;
      r.status = c.status || null;
      r.thumb = c.thumb;
      r.thumbs = c.thumbs;
      r.kind = c.kind;
      r.previewLink = c.previewLink;
    }
    if (!r.name) r.name = `Anuncio ${r.adId}`;
  }

  const isCop = (c: string | null) => !c || c.toUpperCase() === 'COP';
  const sameCurrency = cfg.accounts.every((a) => isCop(a.currency));
  const list = Array.from(rows.values());
  const t = list.filter((r) => isCop(r.currency)).reduce(
    (a, r) => ({ spend: a.spend + r.spend, orders: a.orders + r.orders, confirmed: a.confirmed + r.confirmed, cancelled: a.cancelled + r.cancelled, revenue: a.revenue + r.revenue, chats: a.chats + r.chats }),
    { spend: 0, orders: 0, confirmed: 0, cancelled: 0, revenue: 0, chats: 0 },
  );
  const totals = { ...t, cpa: t.confirmed && t.spend ? t.spend / t.confirmed : null, roas: t.spend ? t.revenue / t.spend : null };

  // "Gastó sin vender": already spent what a confirmed sale usually costs in this account (or 30.000 COP / 10 USD) with no sale.
  const wasteMin = Math.max(totals.cpa || 0, 30000);
  for (const r of list) {
    r.cpa = r.confirmed && r.spend > 0 ? r.spend / r.confirmed : null;
    r.roas = isCop(r.currency) && r.spend > 0 ? r.revenue / r.spend : null;
    // Thresholds are in COP; for other currencies use a small fixed amount (10 USD/EUR…).
    if (r.confirmed === 0 && r.spend >= (isCop(r.currency) ? wasteMin : 10)) r.flags.push('waste');
    if (r.orders >= 3 && r.cancelled / r.orders >= 0.4) r.flags.push('cancels');
  }
  // Winners: the 3 ads with most confirmed sales that also beat the account's ROAS (or, without spend data, sell the most).
  list
    .filter((r) => r.confirmed >= 2 && r.spend > 0 && (r.roas === null || totals.roas === null || r.roas >= Math.max(1, totals.roas)))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
    .forEach((r) => r.flags.push('winner'));

  list.sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
  return { range, since, until, currency: cfg.currency, sameCurrency, accounts: perAccount.map((p) => ({ ...p.account, error: p.error })), rows: list, totals, unattributed, wasteMin, creativesError: rows.size && !Object.keys(creatives).length ? creativesError : null };
}
