// Rentabilidad: stored per store in the "settings" table (rows "profit_config" and "profit_ledger").
// Only the owner and admins see or change it.
import { db, listLandings } from '@/lib/server/db';
import { getProducts } from '@/lib/server/products';
import { adsConfig } from '@/lib/server/integrations';
import { adDailySpend } from '@/lib/server/meta-ads';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import {
  DEFAULT_PROFIT_CONFIG,
  EMPTY_LEDGER,
  adProducts,
  cleanConfig,
  computeProfit,
  partnerShares,
  type MetaSpendRow,
  type ProfitConfig,
  type ProfitLedger,
  type ProfitOrder,
} from '@/lib/profit';
import type { OrderItem } from '@/lib/types';

export class ProfitForbidden extends Error {
  status = 403;
}
export async function requireProfitAccess() {
  const role = await currentRole();
  if (role !== 'owner' && role !== 'admin') throw new ProfitForbidden('Solo el dueño o un administrador pueden ver la rentabilidad.');
  return currentOrgId();
}

async function read<T>(id: string): Promise<T | null> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}
async function write(id: string, data: unknown) {
  const { error } = await (await db()).from('settings').upsert({ id, data });
  if (error) throw new Error(error.message);
}

export async function getProfitConfig(): Promise<ProfitConfig> {
  const c = await read<Partial<ProfitConfig>>('profit_config');
  return c ? cleanConfig({ ...DEFAULT_PROFIT_CONFIG, ...c }) : DEFAULT_PROFIT_CONFIG;
}
export const saveProfitConfig = (c: ProfitConfig) => write('profit_config', c);

export async function getLedger(): Promise<ProfitLedger> {
  const l = await read<Partial<ProfitLedger>>('profit_ledger');
  return { ...EMPTY_LEDGER, ...(l || {}) } as ProfitLedger;
}
export const saveLedger = (l: ProfitLedger) => write('profit_ledger', l);

// Products the store sells (landings and WhatsApp products), for names and costs.
export async function profitProducts(): Promise<{ id: string; name: string }[]> {
  const [landings, products] = await Promise.all([listLandings().catch(() => []), getProducts().catch(() => [])]);
  return [...landings.map((l) => ({ id: l.id, name: l.productName || l.title || 'Producto' })), ...products.map((p) => ({ id: p.id, name: p.name }))];
}

const DAY = 86400000;
async function ordersFor(since: string, until: string): Promise<{ inRange: ProfitOrder[]; forAds: { adId?: string | null; productId: string }[] }> {
  // 90 days before the period too, to know which product each ad sells.
  const from = new Date(new Date(`${since}T00:00:00-05:00`).getTime() - 90 * DAY).toISOString();
  const fromRange = new Date(`${since}T00:00:00-05:00`).toISOString();
  const to = new Date(`${until}T23:59:59.999-05:00`).toISOString();
  const { data, error } = await (await db()).from('orders').select('data, status, created_at').gte('created_at', from).lte('created_at', to).limit(20000);
  if (error) throw new Error(error.message);
  const all = (data || []).map((r: any) => {
    const o = r.data as OrderItem;
    return { createdAt: o.createdAt || r.created_at, status: r.status || o.status, totalAmount: Number(o.totalAmount) || 0, units: Number(o.units) || 1, productId: o.landingPageId || '', adId: o.adId || null };
  });
  return { inRange: all.filter((o) => o.createdAt >= fromRange), forAds: all };
}

async function metaSpend(since: string, until: string): Promise<{ rows: MetaSpendRow[]; connected: boolean; error: string | null; skipped: string[] }> {
  const cfg = await adsConfig().catch(() => null);
  if (!cfg || !cfg.accounts.length) return { rows: [], connected: false, error: null, skipped: [] };
  const rows: MetaSpendRow[] = [];
  const skipped: string[] = [];
  let error: string | null = null;
  for (const a of cfg.accounts) {
    // Profit is in pesos: accounts in another currency are left out (and listed).
    if (a.currency && a.currency.toUpperCase() !== 'COP') {
      skipped.push(`${a.name || a.id} (${a.currency})`);
      continue;
    }
    try {
      rows.push(...(await adDailySpend({ ...cfg, accountId: a.id }, since, until)));
    } catch (e: any) {
      error = e?.expired ? 'La conexión con Meta venció. Vuelve a conectarla en Integraciones.' : String(e?.message || e).slice(0, 200);
    }
  }
  return { rows, connected: true, error, skipped };
}

export async function profitReport(since: string, until: string) {
  const [cfg, ledger, orders, meta, products] = await Promise.all([getProfitConfig(), getLedger(), ordersFor(since, until), metaSpend(since, until), profitProducts()]);
  const adProduct = adProducts(orders.forAds, meta.rows, cfg);
  const report = computeProfit({ since, until, orders: orders.inRange, meta: meta.rows, adProduct, ledger, cfg });
  return {
    report,
    config: cfg,
    ledger,
    products,
    meta: { connected: meta.connected, error: meta.error, skipped: meta.skipped },
    partners: { projected: partnerShares(ledger, report.total.projected.profit), real: partnerShares(ledger, report.total.real.profit) },
  };
}
