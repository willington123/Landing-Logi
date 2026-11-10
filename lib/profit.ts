// "Rentabilidad": ad spend (Meta automatic + manual), tools and fixed costs, budgets per product, partners'
// contributions, and the profit of the period: projected (confirmed × delivery rate) and real (delivered vs returned).
// Shared by the page and the server; the math lives in computeProfit so it can be tested on its own.

export type ExpenseKind = 'ads' | 'tool' | 'fixed';
export const EXPENSE_KINDS: { id: ExpenseKind; label: string; hint: string }[] = [
  { id: 'ads', label: 'Pauta', hint: 'Recargas o gasto de anuncios que no viene de Meta (TikTok, Google…) o pauta de Meta pagada aparte.' },
  { id: 'tool', label: 'Herramienta', hint: 'Suscripciones: Konnexa, Dropi, Shopify, Canva, CapCut… Se reparte entre los días del mes.' },
  { id: 'fixed', label: 'Gasto fijo', hint: 'Nómina, asesores, arriendo, servicios… Se reparte entre los días del mes.' },
];
export const AD_CHANNELS = [
  { id: 'meta', label: 'Meta' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'google', label: 'Google' },
  { id: 'otro', label: 'Otro' },
];

export interface Receipt {
  path: string; // storage path (served only through /api/profit/receipt)
  name: string;
  mime: string;
}
export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  kind: ExpenseKind;
  channel: string | null; // ads only
  productId: string | null; // ads only: the product it was for (null = general)
  concept: string;
  amount: number;
  receipt: Receipt | null;
  by: string | null;
  createdAt: string;
}
export interface Budget {
  id: string;
  month: string; // YYYY-MM
  productId: string | null; // null = general
  amount: number;
  note: string;
}
export interface Partner {
  id: string;
  name: string;
  share: number | null; // % of the profit agreed; null = in proportion to what each one put in
}
export interface Contribution {
  id: string;
  partnerId: string;
  date: string;
  amount: number;
  note: string;
  receipt: Receipt | null;
  createdAt: string;
}
export interface ProfitConfig {
  deliveryRate: number; // % of confirmed orders that end up delivered (for the projection)
  shipping: number; // freight per shipped order
  returnShipping: number; // extra freight when it comes back
  commissionFixed: number; // per delivered order (collection, Dropi…)
  commissionPercent: number; // % of the delivered value
  productCosts: Record<string, number>; // product id → cost per unit
  campaignProducts: Record<string, string>; // Meta campaign name → product id (when the ad has no orders yet)
}
export interface ProfitLedger {
  expenses: Expense[];
  budgets: Budget[];
  partners: Partner[];
  contributions: Contribution[];
}

export const DEFAULT_PROFIT_CONFIG: ProfitConfig = { deliveryRate: 70, shipping: 0, returnShipping: 0, commissionFixed: 0, commissionPercent: 0, productCosts: {}, campaignProducts: {} };
export const EMPTY_LEDGER: ProfitLedger = { expenses: [], budgets: [], partners: [], contributions: [] };

export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
export const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
// Pesos without decimals: "15.000", "$ 15,000" and 15000 are all 15.000 (dots and commas are thousands separators).
const money = (v: unknown) => (typeof v === 'number' ? Math.max(0, Math.round(v)) : Math.round(Number(String(v ?? '').replace(/[^\d]/g, '')) || 0));
const pct = (v: unknown, max = 100) => Math.min(max, Math.max(0, Number(v) || 0));
const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function cleanConfig(input: any): ProfitConfig {
  const costs: Record<string, number> = {};
  for (const [k, v] of Object.entries(input?.productCosts || {}).slice(0, 500)) if (/^[\w-]{1,60}$/.test(k) && money(v) > 0) costs[k] = money(v);
  const camps: Record<string, string> = {};
  for (const [k, v] of Object.entries(input?.campaignProducts || {}).slice(0, 500)) if (text(k, 200) && /^[\w-]{1,60}$/.test(String(v))) camps[text(k, 200)] = String(v);
  return {
    deliveryRate: input?.deliveryRate === undefined ? DEFAULT_PROFIT_CONFIG.deliveryRate : pct(input.deliveryRate),
    shipping: money(input?.shipping),
    returnShipping: money(input?.returnShipping),
    commissionFixed: money(input?.commissionFixed),
    commissionPercent: pct(input?.commissionPercent, 50),
    productCosts: costs,
    campaignProducts: camps,
  };
}

const cleanReceipt = (r: any): Receipt | null =>
  r && typeof r.path === 'string' && /^receipts\/[\w-]+\/[\w-]+\.[a-z0-9]{2,5}$/.test(r.path) ? { path: r.path, name: text(r.name, 120) || 'comprobante', mime: text(r.mime, 80) || 'application/octet-stream' } : null;

export function cleanExpense(input: any, by: string | null): Expense | string {
  const kind = EXPENSE_KINDS.some((k) => k.id === input?.kind) ? (input.kind as ExpenseKind) : null;
  if (!kind) return 'Elige el tipo de gasto.';
  if (!isDay(input?.date)) return 'Elige la fecha.';
  const amount = money(input?.amount);
  if (!amount) return 'Escribe el valor.';
  const concept = text(input?.concept, 120) || (kind === 'ads' ? 'Pauta' : '');
  if (!concept) return 'Escribe el concepto (por ejemplo "Dropi" o "Nómina").';
  return {
    id: /^exp-[\w]{4,30}$/.test(String(input?.id || '')) ? String(input.id) : newId('exp-'),
    date: input.date,
    kind,
    channel: kind === 'ads' ? (AD_CHANNELS.some((c) => c.id === input?.channel) ? input.channel : 'otro') : null,
    productId: kind === 'ads' && /^[\w-]{1,60}$/.test(String(input?.productId || '')) ? String(input.productId) : null,
    concept,
    amount,
    receipt: cleanReceipt(input?.receipt),
    by,
    createdAt: typeof input?.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
  };
}

export function cleanBudget(input: any): Budget | string {
  if (!isMonth(input?.month)) return 'Elige el mes.';
  const amount = money(input?.amount);
  if (!amount) return 'Escribe cuánto vas a invertir.';
  return {
    id: /^bud-[\w]{4,30}$/.test(String(input?.id || '')) ? String(input.id) : newId('bud-'),
    month: input.month,
    productId: /^[\w-]{1,60}$/.test(String(input?.productId || '')) ? String(input.productId) : null,
    amount,
    note: text(input?.note, 200),
  };
}

export function cleanPartner(input: any): Partner | string {
  const name = text(input?.name, 60);
  if (!name) return 'Escribe el nombre del socio.';
  const share = input?.share === null || input?.share === undefined || input?.share === '' ? null : pct(input.share);
  return { id: /^par-[\w]{4,30}$/.test(String(input?.id || '')) ? String(input.id) : newId('par-'), name, share };
}

export function cleanContribution(input: any, partners: Partner[]): Contribution | string {
  if (!partners.some((p) => p.id === input?.partnerId)) return 'Elige el socio.';
  if (!isDay(input?.date)) return 'Elige la fecha.';
  const amount = money(input?.amount);
  if (!amount) return 'Escribe el valor del aporte.';
  return {
    id: /^con-[\w]{4,30}$/.test(String(input?.id || '')) ? String(input.id) : newId('con-'),
    partnerId: input.partnerId,
    date: input.date,
    amount,
    note: text(input?.note, 200),
    receipt: cleanReceipt(input?.receipt),
    createdAt: typeof input?.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
  };
}

// ---------- the math ----------

export interface ProfitOrder {
  createdAt: string; // ISO
  status: string;
  totalAmount: number;
  units: number;
  productId: string; // landingPageId (landing or prd-… product)
  adId?: string | null;
}
export interface MetaSpendRow {
  date: string;
  adId: string;
  campaign: string;
  spend: number;
}

const CONFIRMED = new Set(['confirmed_by_voice', 'shipped', 'delivered', 'returned']);
const PENDING = new Set(['pending_call', 'calling', 'needs_review', 'unanswered', 'retry_scheduled']);
export const NO_PRODUCT = '_general';

export interface ProfitLine {
  orders: number;
  pending: number;
  cancelled: number;
  confirmed: number;
  confirmedRevenue: number;
  confirmedCost: number; // product cost of the confirmed units
  delivered: number;
  deliveredRevenue: number;
  deliveredCost: number;
  returned: number;
  inTransit: number; // confirmed or shipped, not resolved yet
  adsMeta: number;
  adsManual: number;
  ads: number;
  overhead: number; // tools + fixed costs (spread over the days of their month)
  projected: { revenue: number; productCost: number; shipping: number; commission: number; profit: number };
  real: { revenue: number; productCost: number; shipping: number; commission: number; profit: number };
  roas: number | null; // confirmed revenue / ads
  roasProjected: number | null; // projected revenue / ads
  cpa: number | null; // ads / confirmed
  costPerOrder: number | null; // ads / orders
  confirmRate: number | null; // confirmed / (confirmed + cancelled)
  deliveryRateReal: number | null; // delivered / (delivered + returned)
  missingCost: boolean; // there are sales of a product without its cost
}

function emptyLine(): ProfitLine {
  return {
    orders: 0,
    pending: 0,
    cancelled: 0,
    confirmed: 0,
    confirmedRevenue: 0,
    confirmedCost: 0,
    delivered: 0,
    deliveredRevenue: 0,
    deliveredCost: 0,
    returned: 0,
    inTransit: 0,
    adsMeta: 0,
    adsManual: 0,
    ads: 0,
    overhead: 0,
    projected: { revenue: 0, productCost: 0, shipping: 0, commission: 0, profit: 0 },
    real: { revenue: 0, productCost: 0, shipping: 0, commission: 0, profit: 0 },
    roas: null,
    roasProjected: null,
    cpa: null,
    costPerOrder: null,
    confirmRate: null,
    deliveryRateReal: null,
    missingCost: false,
  };
}

function finish(l: ProfitLine, cfg: ProfitConfig) {
  const r = cfg.deliveryRate / 100;
  const n = l.confirmed;
  l.ads = l.adsMeta + l.adsManual;
  // Projection: of the confirmed orders, r get delivered; all ship; the rest come back (return freight).
  const pr = l.projected;
  pr.revenue = l.confirmedRevenue * r;
  pr.productCost = l.confirmedCost * r; // a returned product goes back to stock
  pr.shipping = n * cfg.shipping + n * (1 - r) * cfg.returnShipping;
  pr.commission = r * (n * cfg.commissionFixed + (l.confirmedRevenue * cfg.commissionPercent) / 100);
  pr.profit = pr.revenue - pr.productCost - pr.shipping - pr.commission - l.ads - l.overhead;
  // Real: only what is already resolved (orders in transit aren't counted yet).
  const re = l.real;
  re.revenue = l.deliveredRevenue;
  re.productCost = l.deliveredCost;
  re.shipping = l.delivered * cfg.shipping + l.returned * (cfg.shipping + cfg.returnShipping);
  re.commission = l.delivered * cfg.commissionFixed + (l.deliveredRevenue * cfg.commissionPercent) / 100;
  re.profit = re.revenue - re.productCost - re.shipping - re.commission - l.ads - l.overhead;
  l.roas = l.ads ? l.confirmedRevenue / l.ads : null;
  l.roasProjected = l.ads ? pr.revenue / l.ads : null;
  l.cpa = l.ads && n ? l.ads / n : null;
  l.costPerOrder = l.ads && l.orders ? l.ads / l.orders : null;
  l.confirmRate = n + l.cancelled ? n / (n + l.cancelled) : null;
  l.deliveryRateReal = l.delivered + l.returned ? l.delivered / (l.delivered + l.returned) : null;
  for (const k of ['revenue', 'productCost', 'shipping', 'commission', 'profit'] as const) {
    pr[k] = Math.round(pr[k]);
    re[k] = Math.round(re[k]);
  }
}

const daysInMonth = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
export function eachDay(since: string, until: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${since}T12:00:00Z`); t <= Date.parse(`${until}T12:00:00Z`) && out.length < 400; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
// Colombia day of an instant.
export const coDay = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3600000).toISOString().slice(0, 10);

// Which product each Meta ad sells: the product most of its orders were for (any date), else its campaign's
// product set by the store, else none.
export function adProducts(allOrders: { adId?: string | null; productId: string }[], spend: MetaSpendRow[], cfg: ProfitConfig): Record<string, string> {
  const votes: Record<string, Record<string, number>> = {};
  for (const o of allOrders) if (o.adId && o.productId) (votes[o.adId] ||= {})[o.productId] = (votes[o.adId][o.productId] || 0) + 1;
  const out: Record<string, string> = {};
  for (const [ad, v] of Object.entries(votes)) out[ad] = Object.entries(v).sort((a, b) => b[1] - a[1])[0][0];
  for (const s of spend) if (!out[s.adId] && cfg.campaignProducts[s.campaign]) out[s.adId] = cfg.campaignProducts[s.campaign];
  return out;
}

export interface ProfitReport {
  since: string;
  until: string;
  total: ProfitLine;
  days: (ProfitLine & { date: string })[];
  products: (ProfitLine & { productId: string })[];
  campaigns: { campaign: string; spend: number; productId: string | null }[]; // Meta campaigns in the period
}

export function computeProfit(input: { since: string; until: string; orders: ProfitOrder[]; meta: MetaSpendRow[]; adProduct: Record<string, string>; ledger: ProfitLedger; cfg: ProfitConfig }): ProfitReport {
  const { since, until, cfg } = input;
  const days = eachDay(since, until);
  const inRange = (d: string) => d >= since && d <= until;
  const total = emptyLine();
  const byDay = new Map(days.map((d) => [d, emptyLine()]));
  const byProduct = new Map<string, ProfitLine>();
  const prod = (id: string | null | undefined) => {
    const k = id || NO_PRODUCT;
    let l = byProduct.get(k);
    if (!l) byProduct.set(k, (l = emptyLine()));
    return l;
  };
  const add = (lines: ProfitLine[], f: (l: ProfitLine) => void) => lines.forEach(f);

  for (const o of input.orders) {
    const day = coDay(o.createdAt);
    if (!inRange(day)) continue;
    const lines = [total, byDay.get(day)!, prod(o.productId)];
    const unitCost = cfg.productCosts[o.productId] || 0;
    const cost = unitCost * Math.max(1, Number(o.units) || 1);
    const value = Number(o.totalAmount) || 0;
    add(lines, (l) => {
      l.orders++;
      if (PENDING.has(o.status)) l.pending++;
      if (o.status === 'cancelled') l.cancelled++;
      if (CONFIRMED.has(o.status)) {
        l.confirmed++;
        l.confirmedRevenue += value;
        l.confirmedCost += cost;
        if (!unitCost) l.missingCost = true;
      }
      if (o.status === 'delivered') {
        l.delivered++;
        l.deliveredRevenue += value;
        l.deliveredCost += cost;
      }
      if (o.status === 'returned') l.returned++;
      if (o.status === 'confirmed_by_voice' || o.status === 'shipped') l.inTransit++;
    });
  }

  const camps = new Map<string, { campaign: string; spend: number; productId: string | null }>();
  for (const s of input.meta) {
    if (!inRange(s.date)) continue;
    const productId = input.adProduct[s.adId] || null;
    add([total, byDay.get(s.date)!, prod(productId)], (l) => (l.adsMeta += s.spend));
    const c = camps.get(s.campaign) || { campaign: s.campaign, spend: 0, productId: cfg.campaignProducts[s.campaign] || null };
    c.spend += s.spend;
    camps.set(s.campaign, c);
  }

  for (const e of input.ledger.expenses) {
    if (e.kind === 'ads') {
      if (!inRange(e.date)) continue;
      add([total, byDay.get(e.date)!, prod(e.productId)], (l) => (l.adsManual += e.amount));
      continue;
    }
    // Tools and fixed costs: spread over the days of their month (a monthly bill doesn't land on one day).
    const ym = e.date.slice(0, 7);
    const perDay = e.amount / daysInMonth(ym);
    for (const d of days) {
      if (d.slice(0, 7) !== ym) continue;
      add([total, byDay.get(d)!, prod(null)], (l) => (l.overhead += perDay));
    }
  }

  finish(total, cfg);
  const dayList = days.map((date) => {
    const l = byDay.get(date)!;
    finish(l, cfg);
    return { date, ...l };
  });
  const products = Array.from(byProduct.entries()).map(([productId, l]) => {
    finish(l, cfg);
    return { productId, ...l };
  });
  products.sort((a, b) => (a.productId === NO_PRODUCT ? 1 : b.productId === NO_PRODUCT ? -1 : b.confirmedRevenue - a.confirmedRevenue));
  return { since, until, total, days: dayList, products, campaigns: Array.from(camps.values()).sort((a, b) => b.spend - a.spend) };
}

// Partners: what each one put in (all time) and their part of a profit.
export function partnerShares(ledger: ProfitLedger, profit: number) {
  const put = (id: string) => ledger.contributions.filter((c) => c.partnerId === id).reduce((n, c) => n + c.amount, 0);
  const totalPut = ledger.partners.reduce((n, p) => n + put(p.id), 0);
  const fixed = ledger.partners.filter((p) => p.share !== null).reduce((n, p) => n + (p.share || 0), 0);
  const rest = Math.max(0, 100 - fixed);
  const byContribution = ledger.partners.filter((p) => p.share === null);
  const putByContribution = byContribution.reduce((n, p) => n + put(p.id), 0);
  return ledger.partners.map((p) => {
    const contributed = put(p.id);
    const share = p.share !== null ? p.share : putByContribution ? (rest * contributed) / putByContribution : byContribution.length ? rest / byContribution.length : 0;
    return { partnerId: p.id, name: p.name, contributed, contributedPct: totalPut ? (contributed / totalPut) * 100 : 0, share, profit: Math.round((profit * share) / 100) };
  });
}
