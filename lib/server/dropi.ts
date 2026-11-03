// Dropi (Colombia): send confirmed cash-on-delivery orders to Dropi and link each landing to a Dropi product.
// Same calls as Dropi's official WooCommerce plugin: https://api.dropi.co/integrations/…, header "dropi-integration-key"
// (the token Dropi gives when you create a store in "Mis Integraciones").
import { decrypt } from '@/lib/server/secrets';
import { storedIntegrations } from '@/lib/server/integrations';
import { requestOrgSync } from '@/lib/server/tenant';
import { DROPI_CO_CITIES, DROPI_CO_STATES } from '@/lib/dropi-places-co';
import type { OrderItem } from '@/lib/types';

const env = (k: string) => (process.env[k] || '').trim();
export const dropiBase = () => (env('DROPI_API_URL') || 'https://api.dropi.co/integrations/').replace(/\/?$/, '/');
const IMG_BASE = 'https://d39ru7awumhhs2.cloudfront.net/';

// What a landing is linked to in Dropi.
export interface DropiLink {
  productId: number;
  name: string;
  type: 'SIMPLE' | 'VARIABLE';
  supplierId: number | null;
  supplierName: string | null;
  variationId: number | null;
  variationName: string | null;
  salePrice: number | null; // supplier price
  image: string | null;
}

// The token, and the store's domain: Dropi asks to name the store after the site's domain, and
// WordPress sends that address with each request, so it is sent too.
export interface DropiAuth {
  token: string;
  domain?: string | null;
}

export interface DropiConfig extends DropiAuth {
  autoSend: boolean;
  links: Record<string, DropiLink>; // landing id → product
}

export async function dropiConfig(orgId?: string | null): Promise<DropiConfig | null> {
  const org = orgId ?? requestOrgSync();
  if (!org) return null;
  const s = (await storedIntegrations(org)).dropi;
  const token = s ? decrypt(s.token) : '';
  if (!s || !token) return null;
  return { token, domain: s.domain || null, autoSend: Boolean(s.autoSend), links: s.links || {} };
}

export class DropiError extends Error {
  denied = false; // Dropi said the token (or the store) is not allowed
}

async function dropi<T = any>(auth: DropiAuth, path: string, body?: unknown): Promise<T> {
  const site = auth.domain ? `https://${auth.domain}` : null;
  let res: Response;
  try {
    res = await fetch(dropiBase() + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'dropi-integration-key': auth.token,
        ...(site ? { 'User-Agent': `Konnexa/1.0; ${site}`, Origin: site, Referer: `${site}/` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
      cache: 'no-store',
    });
  } catch (e: any) {
    throw new DropiError(e?.name === 'TimeoutError' ? 'Dropi no respondió a tiempo. Intenta de nuevo.' : 'No pudimos conectar con Dropi.');
  }
  const d: any = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) {
    const said = [d?.message, d?.status ? `código ${d.status}` : `HTTP ${res.status}`].filter(Boolean).join(', ');
    throw Object.assign(new DropiError(`Dropi no aceptó el token (respondió: ${said}).`), { denied: true });
  }
  if (!d || d.isSuccess === false || !res.ok) {
    const msg = d?.message || d?.error || d?.status || `HTTP ${res.status}`;
    throw new DropiError(typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200));
  }
  return d as T;
}

// ---------- products ----------

export interface DropiProduct {
  id: number;
  name: string;
  type: 'SIMPLE' | 'VARIABLE';
  salePrice: number | null;
  suggestedPrice: number | null;
  stock: number | null;
  image: string | null;
  supplierId: number | null;
  supplierName: string | null;
  variations: { id: number; name: string; stock: number | null; salePrice: number | null }[];
}

const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const sumStock = (list: any[] | undefined) => (Array.isArray(list) ? list.reduce((a, w) => a + (Number(w?.stock) || 0), 0) : 0);

export function mapProduct(p: any): DropiProduct {
  const img = p?.gallery?.[0]?.urlS3 ? IMG_BASE + p.gallery[0].urlS3 : p?.gallery?.[0]?.url || null;
  const variations = (Array.isArray(p?.variations) ? p.variations : []).map((v: any) => ({
    id: Number(v.id),
    name: (Array.isArray(v.attribute_values) ? v.attribute_values.map((a: any) => a?.value).filter(Boolean).join(' / ') : '') || v.sku || `Variante ${v.id}`,
    stock: Number(v.stock) || (v.warehouse_product_variation ? sumStock(v.warehouse_product_variation) : num(v.stock)),
    salePrice: num(v.sale_price),
  }));
  const stock = variations.length
    ? variations.reduce((a: number, v: { stock: number | null }) => a + (v.stock || 0), 0)
    : Number(p?.stock) || (p?.warehouse_product ? sumStock(p.warehouse_product) : num(p?.stock));
  return {
    id: Number(p.id),
    name: String(p.name || `Producto ${p.id}`),
    type: String(p.type || '').toUpperCase() === 'VARIABLE' ? 'VARIABLE' : 'SIMPLE',
    salePrice: num(p.sale_price),
    suggestedPrice: num(p.suggested_price),
    stock,
    image: img,
    supplierId: num(p.user_id) ?? num(p.user?.id),
    supplierName: p.user?.name || null,
    variations,
  };
}

// Search Dropi's catalog (or paste the product id).
export async function searchProducts(auth: DropiAuth, q: string, page = 0): Promise<DropiProduct[]> {
  const term = q.trim();
  if (/^\d{1,12}$/.test(term)) {
    const one = await getProduct(auth, Number(term)).catch(() => null);
    if (one) return [one];
  }
  const d = await dropi<{ objects: any[] }>(auth, 'products/index', {
    startData: page * 20,
    pageSize: 20,
    order_type: 'desc',
    order_by: 'id',
    keywords: term,
    active: true,
    no_count: true,
    integration: true,
    get_stock: false,
  });
  return (Array.isArray(d.objects) ? d.objects : []).map(mapProduct);
}

export async function getProduct(auth: DropiAuth, id: number): Promise<DropiProduct> {
  const d = await dropi<{ objects: any }>(auth, `products/v2/${id}`);
  if (!d.objects) throw new DropiError('Ese producto no existe en Dropi.');
  return mapProduct(d.objects);
}

// The token works (a one-product search).
// What people paste: spaces, quotes, "Bearer …" or "token: …" around the token.
export function cleanToken(v: string) {
  return v
    .trim()
    .replace(/^["'`“”]+|["'`“”]+$/g, '')
    .replace(/^(bearer|token|dropi-integration-key)\s*[:=]?\s*/i, '')
    .replace(/\s+/g, '');
}

// Domain as typed ("https://www.mitienda.com/" → "mitienda.com"); '' if it doesn't look like one.
export function cleanDomain(v: string) {
  const d = v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : '';
}

export async function checkToken(auth: DropiAuth) {
  await dropi(auth, 'products/index', { startData: 0, pageSize: 1, order_type: 'desc', order_by: 'id', keywords: '', active: true, no_count: true, integration: true, get_stock: false });
}

// ---------- addresses ----------

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(d\.?\s?c\.?|departamento( de(l)?)?)\b/g, ' ')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Department name as written in the order → Dropi's department code.
export function dropiState(department: string, city = ''): string | null {
  const d = norm(department);
  const c = norm(city);
  if (/^bogota/.test(d) || (!d && /^bogota/.test(c))) return 'CUN';
  if (/^valle/.test(d)) return 'VAC';
  if (/san andres|providencia/.test(d)) return 'SAP';
  if (/guajira/.test(d)) return 'GUJ';
  if (/norte de santander/.test(d)) return 'NOR';
  for (const [code, name] of Object.entries(DROPI_CO_STATES)) if (norm(name) === d) return code;
  for (const [code, name] of Object.entries(DROPI_CO_STATES)) if (d && (norm(name).startsWith(d) || d.startsWith(norm(name)))) return code;
  return null;
}

// City as Dropi spells it in that department (as written when Dropi doesn't list it).
export function dropiCity(city: string, state: string | null): string {
  const c = norm(city).replace(/^bogota.*/, 'bogota');
  const list = (state && DROPI_CO_CITIES[state]) || [];
  return list.find((x) => norm(x) === c) || city.trim();
}

// ---------- orders ----------

export interface DropiOrderState {
  orderId?: number | string | null;
  sentAt?: string;
  error?: string | null;
  at?: string;
  sending?: string; // while being sent (avoids sending twice)
}

export function buildOrderPayload(order: OrderItem, link: DropiLink) {
  const units = Math.max(1, Number(order.units) || 1);
  const [first, ...rest] = (order.customerName || '').trim().split(/\s+/);
  const state = dropiState(order.department, order.city);
  const product: Record<string, unknown> = {
    id: link.productId,
    name: link.name,
    type: link.type,
    quantity: units,
    price: Math.round((Number(order.totalAmount) || 0) / units),
  };
  if (link.type === 'VARIABLE' && link.variationId) product.variation_id = link.variationId;
  const notes = [order.notes, `Pedido Konnexa ${order.orderNumber}`, order.comboName ? `Oferta: ${order.comboName}` : ''].filter(Boolean).join(' · ');
  return {
    total_order: Number(order.totalAmount) || 0,
    notes,
    name: first || 'Cliente',
    surname: rest.join(' ') || '.',
    dir: order.address,
    country: 'CO',
    state: state || order.department,
    city: dropiCity(order.city, state),
    phone: String(order.phone || '').replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, ''),
    client_email: order.email || '',
    payment_method_id: 1,
    status: 'PENDIENTE CONFIRMACION',
    type: 'FINAL_ORDER',
    rate_type: order.paymentMethod === 'cash_on_delivery' || !order.paymentMethod ? 'CON RECAUDO' : 'SIN RECAUDO',
    products: [product],
    calculate_costs_and_shiping: true,
    supplier_id: link.supplierId,
    shop_order_id: order.orderNumber,
  };
}

// Creates the order in Dropi. Returns Dropi's order id.
export async function createDropiOrder(auth: DropiAuth, order: OrderItem, link: DropiLink): Promise<number | string | null> {
  const d = await dropi<{ objects?: { id?: number | string } }>(auth, 'orders/myorders', buildOrderPayload(order, link));
  return d.objects?.id ?? null;
}
