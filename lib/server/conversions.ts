// Tells Meta about REAL sales: a Purchase when an order is confirmed (or delivered), not when the form is sent.
// - Landing orders: Conversions API on the landing's pixel, with the browser data saved when the order came in.
// - WhatsApp orders from click-to-WhatsApp ads: Conversions API for Business Messaging (ctwa_clid + the WABA's dataset).
import { db, patchOrderData, getLandingById } from '@/lib/server/db';
import { getConversationAds } from '@/lib/server/crm-store';
import { capiConfig, waConfig } from '@/lib/server/integrations';
import { GRAPH_VERSION, sendCapiPurchase } from '@/lib/server/meta-capi';
import type { OrderItem } from '@/lib/types';

export type SaleEvent = 'submit' | 'confirmed' | 'delivered';
export interface ConversionSettings {
  saleEvent: SaleEvent; // when a landing order counts as a Purchase
  whatsapp: boolean; // also report chat sales that came from WhatsApp ads
}
export const DEFAULT_CONVERSIONS: ConversionSettings = { saleEvent: 'confirmed', whatsapp: true };

export interface ConversionLogItem {
  at: string;
  orderNumber: string;
  channel: 'landing' | 'whatsapp';
  event: 'Purchase' | 'Lead';
  value: number;
  ok: boolean;
  error?: string;
}

// Browser data saved with a landing order, so a later Purchase still matches the ad click.
export interface CapiClient {
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  url?: string;
}

const CONFIRMED = new Set(['confirmed_by_voice', 'shipped', 'delivered']);

async function readSetting<T>(id: string): Promise<T | null> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}
async function writeSetting(id: string, data: unknown) {
  const { error } = await (await db()).from('settings').upsert({ id, data });
  if (error) throw new Error(error.message);
}

export async function getConversionSettings(): Promise<ConversionSettings> {
  const s = await readSetting<Partial<ConversionSettings>>('conversions').catch(() => null);
  return {
    saleEvent: s?.saleEvent === 'submit' || s?.saleEvent === 'delivered' ? s.saleEvent : 'confirmed',
    whatsapp: s?.whatsapp !== false,
  };
}

export async function saveConversionSettings(patch: Partial<ConversionSettings>) {
  const cur = await getConversionSettings();
  const next: ConversionSettings = {
    saleEvent: patch.saleEvent && ['submit', 'confirmed', 'delivered'].includes(patch.saleEvent) ? patch.saleEvent : cur.saleEvent,
    whatsapp: typeof patch.whatsapp === 'boolean' ? patch.whatsapp : cur.whatsapp,
  };
  await writeSetting('conversions', next);
  return next;
}

export async function getConversionLog(): Promise<ConversionLogItem[]> {
  return ((await readSetting<{ items?: ConversionLogItem[] }>('conversions_log').catch(() => null))?.items || []).slice(0, 20);
}

async function addLog(item: ConversionLogItem) {
  const items = await getConversionLog().catch(() => []);
  await writeSetting('conversions_log', { items: [item, ...items].slice(0, 20) }).catch(() => {});
}

// Which event the landing form sends (browser pixel + server, same event_id).
// With the Conversions API on and "confirmed"/"delivered", the form is a Lead and the Purchase comes later.
export async function submitEvent(): Promise<'Purchase' | 'Lead'> {
  if (!(await capiConfig())) return 'Purchase';
  return (await getConversionSettings()).saleEvent === 'submit' ? 'Purchase' : 'Lead';
}

const isChatOrder = (o: OrderItem) => o.source === 'whatsapp_bot' || o.adChannel === 'whatsapp';

// Called whenever an order changes status (and when the bot creates a confirmed order). Sends each sale once.
export async function reportSale(order: OrderItem): Promise<void> {
  const sent = (order as any).capiSale as { ok?: boolean } | undefined;
  if (sent?.ok) return;
  const s = await getConversionSettings();
  const isSale = s.saleEvent === 'delivered' ? order.status === 'delivered' : CONFIRMED.has(order.status);
  if (!isSale) return;

  let result: { ok: boolean; error?: string } | null = null;
  let channel: 'landing' | 'whatsapp' = 'landing';
  if (isChatOrder(order)) {
    channel = 'whatsapp';
    if (!s.whatsapp) return;
    const convId = order.whatsappFrom || '';
    const clid = convId ? (await getConversationAds().catch(() => ({}) as Record<string, any>))[convId]?.clid : undefined;
    if (!clid) return; // the chat didn't come from a WhatsApp ad: nothing to tell Meta
    result = await sendWhatsAppPurchase(order, clid);
  } else {
    // "submit": the Purchase already went out with the form.
    if (s.saleEvent === 'submit') return;
    const landing = order.landingPageId ? await getLandingById(order.landingPageId).catch(() => null) : null;
    if (!landing?.metaPixelId || !(await capiConfig())) return;
    const client = ((order as any).capiClient || {}) as CapiClient;
    result = await sendCapiPurchase({
      pixelId: landing.metaPixelId,
      eventId: `${order.id}-sale`,
      eventSourceUrl: client.url,
      value: Number(order.totalAmount) || 0,
      currency: landing.currency || 'COP',
      contentIds: [landing.id],
      contentName: landing.productName,
      numItems: order.units,
      customer: { name: order.customerName, phone: order.phone, city: order.city, region: order.department, country: landing.country },
      client: { ip: client.ip, userAgent: client.userAgent, fbp: client.fbp, fbc: client.fbc },
      externalId: String(order.phone || '').replace(/\D/g, ''),
    });
  }
  const at = new Date().toISOString();
  await patchOrderData(order.id, { capiSale: { ok: result.ok, error: result.error || null, at, channel } }).catch(() => {});
  await addLog({ at, orderNumber: order.orderNumber, channel, event: 'Purchase', value: Number(order.totalAmount) || 0, ok: result.ok, error: result.error });
}

// ---------- WhatsApp (Conversions API for Business Messaging) ----------

async function graph(path: string, token: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

// Each WhatsApp Business account has one dataset for these events; Meta creates it on the first POST.
async function waDataset(wabaId: string, token: string): Promise<string> {
  const cached = await readSetting<{ wabaId: string; id: string }>('wa_dataset').catch(() => null);
  if (cached?.wabaId === wabaId && cached.id) return cached.id;
  const got = await graph(`${wabaId}/dataset`, token).catch(() => null);
  let id = String(got?.data?.[0]?.id || got?.id || '');
  if (!id) id = String((await graph(`${wabaId}/dataset`, token, { method: 'POST' }))?.id || '');
  if (!id) throw new Error('Meta no devolvió el dataset de WhatsApp.');
  await writeSetting('wa_dataset', { wabaId, id }).catch(() => {});
  return id;
}

async function sendWhatsAppPurchase(order: OrderItem, clid: string): Promise<{ ok: boolean; error?: string }> {
  const wa = await waConfig();
  if (!wa) return { ok: false, error: 'WhatsApp no está conectado.' };
  if (!wa.wabaId) return { ok: false, error: 'Falta el ID de la cuenta de WhatsApp Business en Integraciones.' };
  try {
    const dataset = await waDataset(wa.wabaId, wa.token);
    const landing = order.landingPageId ? await getLandingById(order.landingPageId).catch(() => null) : null;
    const cfg = await capiConfig();
    const data = await graph(`${dataset}/events`, wa.token, {
      method: 'POST',
      body: {
        data: [
          {
            event_name: 'Purchase',
            event_time: Math.floor(Date.now() / 1000),
            event_id: `${order.id}-sale`,
            action_source: 'business_messaging',
            messaging_channel: 'whatsapp',
            user_data: { whatsapp_business_account_id: wa.wabaId, ctwa_clid: clid },
            custom_data: { currency: landing?.currency || 'COP', value: Number(order.totalAmount) || 0, content_name: order.productName },
          },
        ],
        ...(cfg?.testCode ? { test_event_code: cfg.testCode } : {}),
      },
    });
    return data?.events_received === 0 ? { ok: false, error: 'Meta no aceptó el evento.' } : { ok: true };
  } catch (e: any) {
    const msg = String(e?.message || e);
    return { ok: false, error: /permission|permiso|\(#10\)|\(#200\)/i.test(msg) ? `El token de WhatsApp no tiene el permiso whatsapp_business_manage_events: ${msg}` : msg };
  }
}
