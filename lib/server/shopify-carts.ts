// Shopify abandoned carts → WhatsApp. The store adds a webhook in Shopify (Configuración → Notificaciones →
// Webhooks: "Creación de pago" / "Actualización de pago", "Creación de pedido preliminar" for contraentrega forms like
// Releasit, and "Creación de pedido") pointing to
// /api/shopify/webhook/<org>. Each checkout with a phone is kept here; if it isn't paid after the store's delay,
// Konnexa sends the "recuperar_carrito" template with Confirmar pedido / No, gracias. "Confirmar pedido" creates the
// order in Konnexa (contraentrega), like any other.
import { createHmac, timingSafeEqual } from 'crypto';
import { db, createOrder, cloudEnabled } from '@/lib/server/db';
import { recordOutbound, linkConversationOrder, samePhone } from '@/lib/server/wa-store';
import { listTemplates, sendText, whatsappEnabled, sendCartTemplate } from '@/lib/server/whatsapp';
import { CART_PRESET } from '@/lib/wa-templates';
import { normalizePhone } from '@/lib/phone';
import { localPhoneDigits } from '@/lib/order-form';
import type { OrderItem } from '@/lib/types';

export interface ShopifySettings {
  enabled: boolean;
  secret: string; // Shopify's webhook signing key (Notificaciones → Webhooks)
  delayMinutes: number; // wait before writing (the customer may still be buying)
}
export const DEFAULT_SHOPIFY: ShopifySettings = { enabled: false, secret: '', delayMinutes: 60 };

export type CartStatus = 'waiting' | 'sent' | 'recovered' | 'declined' | 'purchased' | 'skipped' | 'failed';
export interface ShopifyCart {
  token: string;
  name: string;
  phone: string; // E.164 digits (WhatsApp)
  email?: string;
  items: { title: string; qty: number; price: number }[];
  total: number;
  currency: string;
  address: string;
  city: string;
  department: string;
  url?: string; // Shopify's link to finish the checkout
  createdAt: string;
  updatedAt: string;
  status: CartStatus;
  note?: string; // why it was skipped / the send error
  sentAt?: string;
  orderId?: string;
  orderNumber?: string;
}

const SETTINGS = 'shopify';
const CARTS = 'shopify_carts';
const KEEP_DAYS = 10;
const MAX_CARTS = 400;
const MAX_AGE_TO_WRITE_H = 48; // older carts aren't written to (too late, and outside what the customer expects)

async function read<T>(id: string): Promise<T | null> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}
async function write(id: string, data: unknown) {
  const { error } = await (await db()).from('settings').upsert({ id, data });
  if (error) throw new Error(error.message);
}

export async function getShopifySettings(): Promise<ShopifySettings> {
  const s = (await read<Partial<ShopifySettings>>(SETTINGS)) || {};
  const delay = Number(s.delayMinutes);
  return { ...DEFAULT_SHOPIFY, ...s, delayMinutes: [15, 30, 60, 120, 240, 720].includes(delay) ? delay : DEFAULT_SHOPIFY.delayMinutes };
}
export const saveShopifySettings = (s: ShopifySettings) => write(SETTINGS, s);

export async function getCarts(): Promise<Record<string, ShopifyCart>> {
  return (await read<{ items?: Record<string, ShopifyCart> }>(CARTS))?.items || {};
}
async function saveCarts(items: Record<string, ShopifyCart>) {
  // Keep the recent ones only.
  const cut = Date.now() - KEEP_DAYS * 86400000;
  const kept = Object.values(items)
    .filter((c) => Date.parse(c.updatedAt) > cut)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_CARTS);
  await write(CARTS, { items: Object.fromEntries(kept.map((c) => [c.token, c])) });
}
async function patchCart(token: string, patch: Partial<ShopifyCart>) {
  const all = await getCarts();
  if (!all[token]) return;
  all[token] = { ...all[token], ...patch };
  await saveCarts(all);
}

// ---------- webhook ----------

// Shopify signs the raw body with the key shown under Notificaciones → Webhooks (base64 HMAC-SHA256).
export function validShopifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const want = createHmac('sha256', secret).update(raw, 'utf8').digest();
  const got = Buffer.from(header, 'base64');
  return got.length === want.length && timingSafeEqual(got, want);
}

const clean = (v: unknown, max = 160) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const money = (v: unknown) => Math.round(Number(v) || 0);

function phoneOf(c: any): string {
  const raw = c?.phone || c?.shipping_address?.phone || c?.billing_address?.phone || c?.customer?.phone || c?.sms_marketing_phone || '';
  const country = /mex/i.test(c?.shipping_address?.country || '') ? 'México' : 'Colombia';
  const d = normalizePhone(String(raw), country);
  return d.length >= 10 ? d : '';
}


// Cities that forms leave as placeholders ("Toca Para Seleccionar", "-", "S", "Ciudad").
function cleanCity(v: unknown): string {
  const c = clean(v, 80);
  if (/^(toca para seleccionar|selecciona.*|ciudad|municipio|-+|\.+|.)$/i.test(c)) return '';
  // "VILLAVICENCIO" → "Villavicencio" (all caps only; "Bogotá D.C." stays).
  return c === c.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(c) ? c.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()) : c;
}

// Releasit (contraentrega form) saves an abandoned form as a draft order tagged "abandoned_checkout_releasit_cod_form",
// with the form's answers in note_attributes. As the checkout shape cartFromCheckout reads, or null if it isn't one.
function draftAsCheckout(d: any): any | null {
  if (!/abandon/i.test(String(d?.tags || ''))) return null; // a draft order the store made by hand
  const attrs: Record<string, string> = {};
  for (const a of Array.isArray(d?.note_attributes) ? d.note_attributes : []) attrs[String(a?.name || '').toLowerCase()] = String(a?.value ?? '');
  const ship = d?.shipping_address || d?.billing_address || {};
  const fullName = attrs['nombre completo'] || ship.name || '';
  return {
    token: `draft-${d?.id}`,
    created_at: d?.created_at,
    completed_at: d?.completed_at || (d?.status === 'completed' ? d?.updated_at || new Date().toISOString() : null),
    phone: ship.phone || attrs['número celular'] || attrs['numero celular'] || attrs['celular'] || d?.customer?.phone || '',
    email: d?.email,
    customer: d?.customer,
    shipping_address: {
      ...ship,
      first_name: ship.first_name || fullName,
      last_name: ship.first_name ? ship.last_name : '',
      city: ship.city || attrs['ciudad'],
      province: ship.province || attrs['departamento'],
      address1: ship.address1 || attrs['dirección'] || attrs['direccion'],
    },
    line_items: d?.line_items,
    total_price: d?.total_price,
    currency: d?.currency,
    abandoned_checkout_url: attrs['recovery url'] || '',
  };
}

// A Shopify checkout (webhook or Admin API) as a cart, or null without a phone or products.
function cartFromCheckout(body: any, prev: ShopifyCart | undefined, now: string): ShopifyCart | null {
  const token = clean(body?.token || body?.cart_token || body?.id, 80);
  const phone = phoneOf(body);
  if (!token || !phone) return null;
  const ship = body?.shipping_address || body?.billing_address || {};
  const name = clean([ship.first_name || body?.customer?.first_name, ship.last_name || body?.customer?.last_name].filter(Boolean).join(' '), 120)
    .replace(/(^|\s)['-]+(?=\s|$)/g, ' ') // forms fill the last name with "-"
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  const items = (Array.isArray(body?.line_items) ? body.line_items : [])
    .slice(0, 10)
    .map((li: any) => ({ title: clean([li.title, li.variant_title].filter(Boolean).join(' - '), 120), qty: Math.max(1, Number(li.quantity) || 1), price: money(li.price) }))
    .filter((li: { title: string }) => li.title);
  if (!items.length) return null;
  return {
    ...(prev || { createdAt: clean(body?.created_at, 40) || now, status: 'waiting' as CartStatus }),
    token,
    name,
    phone,
    email: clean(body?.email, 120) || undefined,
    items,
    total: money(body?.total_price) || items.reduce((s: number, i: { qty: number; price: number }) => s + i.qty * i.price, 0),
    currency: clean(body?.presentment_currency || body?.currency, 5) || 'COP',
    address: clean([ship.address1, ship.address2].filter(Boolean).join(', ')),
    city: cleanCity(ship.city),
    department: clean(ship.province, 80),
    url: clean(body?.abandoned_checkout_url, 500) || undefined,
    updatedAt: now,
  };
}

// checkouts/create and checkouts/update: keep the cart (or mark it paid); orders/create: the customer bought.
export async function handleShopifyEvent(topic: string, body: any) {
  const all = await getCarts();
  const now = new Date().toISOString();
  if (/^orders\//.test(topic)) {
    const token = body?.checkout_token || body?.cart_token;
    const phone = phoneOf(body);
    for (const c of Object.values(all)) {
      if ((token && c.token === token) || (phone && c.phone === phone && ['waiting', 'sent'].includes(c.status))) {
        all[c.token] = { ...c, status: c.status === 'sent' ? 'recovered' : 'purchased', note: 'Compró en Shopify.', updatedAt: now };
      }
    }
    await saveCarts(all);
    return { kept: false };
  }
  // Releasit's abandoned forms arrive as draft orders.
  if (/^draft_orders\//.test(topic)) {
    const asCheckout = draftAsCheckout(body);
    if (!asCheckout) return { kept: false };
    body = asCheckout;
  } else if (!/^checkouts\//.test(topic)) return { kept: false };
  const token = clean(body?.token || body?.cart_token || body?.id, 80);
  if (!token) return { kept: false };
  const prev = all[token];
  if (body?.completed_at) {
    if (prev) all[token] = { ...prev, status: prev.status === 'sent' ? 'recovered' : 'purchased', note: 'Compró en Shopify.', updatedAt: now };
    await saveCarts(all);
    return { kept: false };
  }
  const cart = cartFromCheckout(body, prev, now);
  if (!cart) return { kept: false }; // no phone or no products: nobody / nothing to write about
  all[token] = cart;
  // One message per customer: an older cart of the same phone still waiting is replaced by this one.
  for (const c of Object.values(all))
    if (c.token !== token && c.phone === cart.phone && c.status === 'waiting') all[c.token] = { ...c, status: 'skipped', note: 'Tiene un carrito más reciente.' };
  await saveCarts(all);
  return { kept: true };
}

// ---------- sending ----------

const firstName = (n: string) => ((n || '').trim().split(/\s+/)[0] || 'hola').toLowerCase().replace(/^./, (x) => x.toUpperCase());
const productText = (c: ShopifyCart) => c.items.map((i) => (i.qty > 1 ? `${i.qty} x ${i.title}` : i.title)).join(', ').slice(0, 200);
const totalText = (c: ShopifyCart) => `$${c.total.toLocaleString('es-CO')}${c.currency && c.currency !== 'COP' ? ` ${c.currency}` : ''}`;
export const cartVars = (c: ShopifyCart): string[] => [firstName(c.name), productText(c), totalText(c), c.city || 'tu ciudad'];

async function cartTemplate(): Promise<{ status: string; lang: string } | null> {
  const list = await listTemplates().catch(() => []);
  const t = list.find((x) => x.name === CART_PRESET.name && x.status === 'APPROVED') || list.find((x) => x.name === CART_PRESET.name);
  return t ? { status: t.status, lang: t.language || 'es' } : null;
}

// Did this customer already order in Konnexa lately (e.g. with the contraentrega form)? Then don't write.
async function orderedLately(phone: string, since: number): Promise<boolean> {
  const { data } = await (await db()).from('orders').select('data, created_at').gte('created_at', new Date(since).toISOString()).limit(500);
  return (data || []).some((r: any) => samePhone(r.data as OrderItem, phone));
}

export async function sendCart(c: ShopifyCart): Promise<{ ok: boolean; error?: string }> {
  if (!(await whatsappEnabled())) return { ok: false, error: 'WhatsApp no está conectado.' };
  const tpl = await cartTemplate();
  if (!tpl) return { ok: false, error: 'Crea la plantilla «Recuperar carrito» en Plantillas.' };
  if (tpl.status !== 'APPROVED') return { ok: false, error: `La plantilla «${CART_PRESET.name}» aún no está aprobada por Meta (${tpl.status}).` };
  const vars = cartVars(c);
  const result = await sendCartTemplate(c.phone, tpl, vars, c.token);
  const text = CART_PRESET.body.replace(/\{\{(\d)\}\}/g, (_, i) => vars[Number(i) - 1] || '');
  await recordOutbound({ phone: c.phone, name: c.name, type: 'template', body: text, result, auto: true });
  return result.ok ? { ok: true } : { ok: false, error: result.error || 'error de WhatsApp' };
}

// Scheduled: carts that waited the store's delay and weren't paid.
export async function processCarts(now = new Date()) {
  if (!cloudEnabled()) return null;
  const s = await getShopifySettings();
  if (!s.enabled) return null;
  const all = await getCarts();
  const due = Object.values(all).filter((c) => c.status === 'waiting' && now.getTime() - Date.parse(c.updatedAt) >= s.delayMinutes * 60000);
  if (!due.length) return { sent: 0, skipped: 0, failed: 0 };
  const out = { sent: 0, skipped: 0, failed: 0 };
  for (const c of due.slice(0, 20)) {
    let patch: Partial<ShopifyCart>;
    if (now.getTime() - Date.parse(c.updatedAt) > MAX_AGE_TO_WRITE_H * 3600000) patch = { status: 'skipped', note: 'Pasaron más de 48 horas.' };
    else if (await orderedLately(c.phone, Date.parse(c.createdAt) - 3600000).catch(() => false)) patch = { status: 'skipped', note: 'Ya tiene un pedido en Konnexa.' };
    else if (Object.values(all).some((o) => o.token !== c.token && o.phone === c.phone && o.sentAt && now.getTime() - Date.parse(o.sentAt) < 3 * 86400000))
      patch = { status: 'skipped', note: 'Ya se le escribió por otro carrito hace poco.' };
    else {
      const r = await sendCart(c);
      patch = r.ok ? { status: 'sent', sentAt: new Date().toISOString(), note: undefined } : { status: 'failed', note: r.error };
    }
    patch.status === 'sent' ? out.sent++ : patch.status === 'failed' ? out.failed++ : out.skipped++;
    all[c.token] = { ...all[c.token], ...patch };
  }
  // Re-read before saving: a webhook may have arrived meanwhile.
  const fresh = await getCarts();
  for (const c of due) if (fresh[c.token] && fresh[c.token].status === 'waiting') fresh[c.token] = { ...fresh[c.token], ...all[c.token], updatedAt: fresh[c.token].updatedAt };
  await saveCarts(fresh);
  return out;
}

// ---------- the customer's answer ----------

// "Confirmar pedido" / "No, gracias" on the cart template (payload cart_confirm:<token> / cart_cancel:<token>).
export async function cartButton(phone: string, action: 'confirm' | 'cancel', token: string): Promise<string> {
  const all = await getCarts();
  const c = all[token];
  if (!c || c.phone !== phone) return 'Este carrito ya no está disponible. Si quieres hacer un pedido, escríbenos por aquí.';
  if (c.status === 'recovered' || c.orderId) return `Tu pedido ya quedó registrado${c.orderNumber ? ` (${c.orderNumber})` : ''} ✅ Si necesitas cambiar algo, escríbenos por aquí.`;
  if (action === 'cancel') {
    await patchCart(token, { status: 'declined', note: 'El cliente respondió que no.' });
    return 'Entendido, gracias por avisarnos 🙏 Si más adelante lo quieres, escríbenos por aquí.';
  }
  const now = new Date().toISOString();
  const complete = c.address.length >= 6 && /\d/.test(c.address) && c.city.length >= 2;
  const units = c.items.reduce((s, i) => s + i.qty, 0);
  const order: OrderItem = {
    id: `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    orderNumber: `LP-${Math.floor(10000 + Math.random() * 90000)}`,
    landingPageId: '',
    productName: c.items.map((i) => i.title).join(' + ').slice(0, 160),
    comboName: c.items.map((i) => `${i.qty} x ${i.title}`).join(', ').slice(0, 200),
    units,
    totalAmount: c.total,
    customerName: c.name || 'Cliente Shopify',
    phone: localPhoneDigits(c.phone),
    email: c.email,
    department: c.department,
    city: c.city,
    address: c.address,
    notes: 'Carrito abandonado de Shopify recuperado por WhatsApp.',
    paymentMethod: 'cash_on_delivery',
    status: complete ? 'confirmed_by_voice' : 'needs_review',
    ...(complete ? { confirmedAt: now } : {}),
    confirmedVia: 'whatsapp',
    source: 'shopify_cart',
    utmSource: 'shopify',
    utmCampaign: 'carrito-abandonado',
    whatsappFrom: phone,
    createdAt: now,
  };
  await createOrder(order);
  await linkConversationOrder(phone, order.id).catch(() => {});
  await patchCart(token, { status: 'recovered', orderId: order.id, orderNumber: order.orderNumber, note: undefined });
  return complete
    ? `¡Listo ${firstName(c.name)}! Tu pedido quedó confirmado ✅ Lo enviamos a ${c.city} y pagas al recibir. Te avisamos cuando salga con el número de guía.`
    : `¡Perfecto ${firstName(c.name)}! Para enviarte tu pedido necesitamos la dirección completa (calle y número, barrio), ciudad y departamento. Escríbela aquí 🙏`;
}

// "Enviar ahora": the template to the chosen carts, one by one (at most 50).
export async function sendCarts(tokens: string[]): Promise<{ sent: number; failed: number; error?: string }> {
  const all = await getCarts();
  const out: { sent: number; failed: number; error?: string } = { sent: 0, failed: 0 };
  for (const t of Array.from(new Set(tokens)).slice(0, 50)) {
    const c = all[t];
    if (!c || !['waiting', 'failed'].includes(c.status)) continue;
    const r = await sendCart(c);
    if (r.ok) {
      out.sent++;
      all[t] = { ...c, status: 'sent', sentAt: new Date().toISOString(), note: undefined };
    } else {
      out.failed++;
      out.error = r.error;
      // The template isn't ready or WhatsApp isn't connected: stop and leave the carts as they were.
      if (/plantilla|WhatsApp no está conectado/.test(r.error || '')) break;
      all[t] = { ...c, status: 'failed', note: r.error };
    }
  }
  const fresh = await getCarts();
  for (const t of tokens) if (fresh[t] && all[t]) fresh[t] = { ...fresh[t], status: all[t].status, sentAt: all[t].sentAt, note: all[t].note };
  await saveCarts(fresh);
  return out;
}

export const markCartSent = (token: string) => patchCart(token, { status: 'sent', sentAt: new Date().toISOString(), note: undefined });

export async function replyText(phone: string, text: string, orderId?: string) {
  const result = await sendText(phone, text);
  await recordOutbound({ phone, orderId, type: 'text', body: text, result, auto: true });
}
