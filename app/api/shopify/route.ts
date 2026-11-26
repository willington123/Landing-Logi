import { NextRequest } from 'next/server';
import { currentOrgId } from '@/lib/server/tenant';
import { requireManager } from '@/lib/server/integrations-api';
import { publicBaseUrl } from '@/lib/server/vapi';
import { DEFAULT_SHOPIFY, getCarts, getShopifySettings, saveShopifySettings, sendCart } from '@/lib/server/shopify-carts';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Integraciones → Shopify (carritos abandonados): settings, the webhook address and the latest carts.
export async function GET(req: NextRequest) {
  try {
    const org = await currentOrgId();
    const [s, carts] = await Promise.all([getShopifySettings(), getCarts()]);
    const list = Object.values(carts)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 50)
      .map(({ token, name, phone, items, total, currency, city, status, note, updatedAt, sentAt, orderNumber }) => ({ token, name, phone, items, total, currency, city, status, note, updatedAt, sentAt, orderNumber }));
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
    await saveShopifySettings({ ...DEFAULT_SHOPIFY, ...s, secret, enabled, delayMinutes: [15, 30, 60, 120, 240, 720].includes(delay) ? delay : s.delayMinutes });
    return ok({});
  } catch (e) {
    return failFrom(e);
  }
}

// "Enviar ahora" for one cart. Body: { token }
export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const carts = await getCarts();
    const c = carts[String(b.token || '')];
    if (!c) return fail('Carrito no encontrado.', 404);
    if (c.status === 'recovered' || c.status === 'purchased') return fail('Ese carrito ya terminó en compra.');
    const r = await sendCart(c);
    if (!r.ok) return fail(r.error || 'No se pudo enviar.');
    const { markCartSent } = await import('@/lib/server/shopify-carts');
    await markCartSent(c.token);
    return ok({ sent: true });
  } catch (e) {
    return failFrom(e);
  }
}
