// Meta Conversions API (server-side events). Server-only: uses the CAPI access token.
// Sends the same event_id as the browser pixel so Meta deduplicates them.
import { createHash } from 'crypto';
import { CALLING_CODES, normalizePhone } from '@/lib/phone';
import { capiConfig } from '@/lib/server/integrations';

export { normalizePhone };

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';

export async function capiEnabled(): Promise<boolean> {
  return Boolean(await capiConfig());
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const norm = (v?: string) =>
  (v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export interface CapiPurchase {
  eventName?: 'Purchase' | 'Lead'; // Purchase by default
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
  const cfg = await capiConfig();
  if (!cfg || !/^\d{10,20}$/.test(p.pixelId || '')) return { ok: false, error: 'CAPI no configurado' };

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
        event_name: p.eventName || 'Purchase',
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
  if (cfg.testCode) body.test_event_code = cfg.testCode;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${p.pixelId}/events?access_token=${encodeURIComponent(cfg.token)}`, {
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
