// Meta Conversions API (server-side events). Server-only: uses the CAPI access token.
// Sends the same event_id as the browser pixel so Meta deduplicates them.
import { createHash } from 'crypto';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';

export function capiEnabled(): boolean {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN?.trim());
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const norm = (v?: string) =>
  (v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const CALLING_CODES: Record<string, { code: string; iso: string; localLength: number }> = {
  Colombia: { code: '57', iso: 'co', localLength: 10 },
  México: { code: '52', iso: 'mx', localLength: 10 },
  Perú: { code: '51', iso: 'pe', localLength: 9 },
  Chile: { code: '56', iso: 'cl', localLength: 9 },
  Ecuador: { code: '593', iso: 'ec', localLength: 9 },
  Guatemala: { code: '502', iso: 'gt', localLength: 8 },
  España: { code: '34', iso: 'es', localLength: 9 },
};

// Meta wants phones with country code, digits only (e.g. 573001234567).
export function normalizePhone(phone: string, country?: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  const cc = CALLING_CODES[country || 'Colombia'] || CALLING_CODES.Colombia;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === cc.localLength) digits = cc.code + digits;
  if (cc.code === '593' && digits.length === 10 && digits.startsWith('0')) digits = cc.code + digits.slice(1);
  return digits;
}

export interface CapiPurchase {
  pixelId: string;
  eventId: string;
  eventSourceUrl?: string;
  value: number;
  currency: string;
  contentIds: string[];
  contentName: string;
  numItems: number;
  customer: { name: string; phone: string; city?: string; region?: string; country?: string };
  client: { ip?: string; userAgent?: string; fbp?: string; fbc?: string };
  externalId?: string;
}

export async function sendCapiPurchase(p: CapiPurchase): Promise<{ ok: boolean; error?: string; eventsReceived?: number }> {
  if (!capiEnabled() || !/^\d{10,20}$/.test(p.pixelId || '')) return { ok: false, error: 'CAPI no configurado' };

  const [first, ...rest] = norm(p.customer.name).split(/\s+/);
  const cc = CALLING_CODES[p.customer.country || 'Colombia'] || CALLING_CODES.Colombia;
  const phone = normalizePhone(p.customer.phone, p.customer.country);

  const user_data: Record<string, unknown> = {
    ph: phone ? [sha256(phone)] : undefined,
    fn: first ? [sha256(first)] : undefined,
    ln: rest.length ? [sha256(rest.join(''))] : undefined,
    ct: p.customer.city ? [sha256(norm(p.customer.city).replace(/[^a-z]/g, ''))] : undefined,
    st: p.customer.region ? [sha256(norm(p.customer.region).replace(/[^a-z]/g, ''))] : undefined,
    country: [sha256(cc.iso)],
    external_id: p.externalId ? [sha256(p.externalId)] : undefined,
    client_ip_address: p.client.ip || undefined,
    client_user_agent: p.client.userAgent || undefined,
    fbp: p.client.fbp || undefined,
    fbc: p.client.fbc || undefined,
  };
  Object.keys(user_data).forEach((k) => user_data[k] === undefined && delete user_data[k]);

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: p.eventId,
        action_source: 'website',
        event_source_url: p.eventSourceUrl,
        user_data,
        custom_data: {
          value: p.value,
          currency: p.currency,
          content_ids: p.contentIds,
          content_name: p.contentName,
          content_type: 'product',
          num_items: p.numItems,
        },
      },
    ],
  };
  if (process.env.META_CAPI_TEST_CODE?.trim()) body.test_event_code = process.env.META_CAPI_TEST_CODE.trim();

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${p.pixelId}/events?access_token=${encodeURIComponent(process.env.META_CAPI_ACCESS_TOKEN!.trim())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    return { ok: true, eventsReceived: data?.events_received };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'Meta no respondió a tiempo' : e?.message || String(e) };
  }
}
