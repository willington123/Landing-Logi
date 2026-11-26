import { NextRequest } from 'next/server';
import { currentOrgId } from '@/lib/server/tenant';
import { requireManager } from '@/lib/server/integrations-api';
import { publicBaseUrl } from '@/lib/server/vapi';
import { CART_DELAYS, DEFAULT_SHOPIFY, getCarts, getShopifySettings, saveShopifySettings, sendCarts } from '@/lib/server/shopify-carts';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Integraciones → Shopify (carritos abandonados): settings, the webhook address and the latest carts.
export async function GET(req: NextRequest) {
  try {
    const org = await currentOrgId();
    const [s, carts] = await Promise.all([getShopifySettings(), getCarts()]);
    const list = Object.values(carts)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 300)
      .map(({ token, name, phone, items, total, currency, city, status, note, createdAt, updatedAt, sentAt, orderNumber }) => ({ token, name, phone, items, total, currency, city, status, note, createdAt, updatedAt, sentAt, orderNumber }));
    return ok({
      settings: { enabled: s.enabled, delayMinutes: s.delayMinutes, hasSecret: Boolean(s.secret) },
      webhookUrl: `${publicBaseUrl(req.nextUrl.origin)}/api/shopify/webhook/${org}`,
      carts: list,
    });
  } catch (e) {
    return failFrom(e);
  }
}

// Body: { enabled?, delayMinutes?, secret? } (an empty secret keeps the saved one).
export async function PUT(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const s = await getShopifySettings();
    const secret = typeof b.secret === 'string' && b.secret.trim() ? b.secret.trim().slice(0, 200) : s.secret;
    const enabled = typeof b.enabled === 'boolean' ? b.enabled : s.enabled;
    if (enabled && !secret) return fail('Pega la clave de firma de los webhooks de Shopify para activarlo.');
    const delay = Number(b.delayMinutes ?? s.delayMinutes);
    await saveShopifySettings({ ...DEFAULT_SHOPIFY, ...s, secret, enabled, delayMinutes: CART_DELAYS.includes(delay) ? delay : s.delayMinutes });
    return ok({});
  } catch (e) {
    return failFrom(e);
  }
}

// "Enviar ahora": { token } or { tokens: [...] }.
export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const tokens: string[] = Array.isArray(b.tokens) ? b.tokens.map(String) : b.token ? [String(b.token)] : [];
    if (!tokens.length) return fail('Elige al menos un carrito.');
    const r = await sendCarts(tokens);
    if (!r.sent && r.error) return fail(r.error);
    return ok(r);
  } catch (e) {
    return failFrom(e);
  }
}
