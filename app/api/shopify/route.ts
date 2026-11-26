import { NextRequest } from 'next/server';
import { currentOrgId } from '@/lib/server/tenant';
import { requireManager } from '@/lib/server/integrations-api';
import { publicBaseUrl } from '@/lib/server/vapi';
import { DEFAULT_SHOPIFY, getCarts, getShopifySettings, importOldCarts, saveShopifySettings, sendCarts, shopDomain, testShopifyAdmin } from '@/lib/server/shopify-carts';
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
      settings: { enabled: s.enabled, delayMinutes: s.delayMinutes, hasSecret: Boolean(s.secret), shop: s.shop ? `${shopDomain(s.shop)}.myshopify.com` : null, hasAdmin: Boolean(s.shop && s.adminToken) },
      webhookUrl: `${publicBaseUrl(req.nextUrl.origin)}/api/shopify/webhook/${org}`,
      carts: list,
    });
  } catch (e) {
    return failFrom(e);
  }
}

// Body: { enabled?, delayMinutes?, secret? } (an empty secret keeps the saved one),
// or { shop, adminToken } to connect the Shopify app (checked first), or { disconnectAdmin: true }.
export async function PUT(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const s = await getShopifySettings();
    if (b.disconnectAdmin) {
      await saveShopifySettings({ ...s, shop: undefined, adminToken: undefined });
      return ok({});
    }
    if (typeof b.adminToken === 'string' || typeof b.shop === 'string') {
      const shop = shopDomain(b.shop || s.shop || '');
      const token = String(b.adminToken || '').trim() || s.adminToken || '';
      if (!shop) return fail('Escribe el dominio de tu tienda (ej. mitienda.myshopify.com).');
      if (!/^shp[a-z]{2}_[A-Za-z0-9]{20,}$/.test(token)) return fail('La clave de la app de Shopify empieza por shpat_ (cópiala completa).');
      try {
        await testShopifyAdmin(shop, token);
      } catch (e: any) {
        return fail(e.message);
      }
      await saveShopifySettings({ ...s, shop, adminToken: token });
      return ok({});
    }
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

// { token } or { tokens: [...] }: send now. { importDays: n }: bring the abandoned carts of the last n days.
export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    if (b.importDays !== undefined) {
      const days = Number(b.importDays);
      if (![3, 7, 15, 30].includes(days)) return fail('Elige 3, 7, 15 o 30 días.');
      try {
        return ok({ imported: await importOldCarts(days) });
      } catch (e: any) {
        return fail(e.message);
      }
    }
    const tokens: string[] = Array.isArray(b.tokens) ? b.tokens.map(String) : b.token ? [String(b.token)] : [];
    if (!tokens.length) return fail('Elige al menos un carrito.');
    const r = await sendCarts(tokens);
    if (!r.sent && r.error) return fail(r.error);
    return ok(r);
  } catch (e) {
    return failFrom(e);
  }
}
