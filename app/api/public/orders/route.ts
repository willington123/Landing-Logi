import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, createOrder, getPublicLandingWithOrg, patchOrderData } from '@/lib/server/db';
import { runWithOrg } from '@/lib/server/tenant';
import { capiEnabled, sendCapiPurchase } from '@/lib/server/meta-capi';
import { confirmTemplateEnabled } from '@/lib/server/whatsapp';
import { sendOrderConfirmation } from '@/lib/server/wa-actions';
import { getWaSettings } from '@/lib/server/wa-store';
import { onNewOrder } from '@/lib/server/voice-actions';
import type { LandingPageConfig, OrderItem } from '@/lib/types';
import { serverOrderErrors } from '@/lib/order-form';

export const dynamic = 'force-dynamic';

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

// Public endpoint used by landing pages to place cash-on-delivery orders.
// Price and product come from the stored landing, never from the browser.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const b = await req.json();
    const found = await getPublicLandingWithOrg(clean(b.landingId, 120));
    if (!found) return NextResponse.json({ success: false, error: 'Landing no encontrada.' }, { status: 404 });
    // Everything below (order, WhatsApp, calls) belongs to the landing's account.
    return await runWithOrg(found.orgId, () => placeOrder(req, b, found.landing));
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}

async function placeOrder(req: NextRequest, b: any, landing: LandingPageConfig) {
  try {

    const units = Number(b.units) || 0;
    const combo = landing.combos.find((c) => c.units === units) || landing.combos[0];
    const name = clean(b.customerName, 120);
    const phone = clean(b.phone, 40);
    const city = clean(b.city, 80);
    const address = clean(b.address, 240);
    if (!combo) return NextResponse.json({ success: false, error: 'Faltan datos del pedido.' }, { status: 400 });
    // Same rules as the landing form (phone digits by country, name + surname, full address).
    const invalid = serverOrderErrors({ name, phone, city, address }, landing.country);
    if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 });

    const id = `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const order: OrderItem = {
      id,
      orderNumber: `LP-${Math.floor(10000 + Math.random() * 90000)}`,
      landingPageId: landing.id,
      productName: landing.productName,
      comboName: combo.name,
      units: combo.units,
      totalAmount: combo.promoPrice,
      customerName: name,
      phone,
      department: clean(b.department, 80),
      city,
      address,
      notes: clean(b.notes, 300),
      paymentMethod: 'cash_on_delivery',
      status: 'pending_call',
      utmSource: clean(b.utmSource, 80) || undefined,
      utmCampaign: clean(b.utmCampaign, 120) || undefined,
      createdAt: new Date().toISOString(),
    };
    await createOrder(order);

    // Meta Conversions API: same event_id (order.id) as the browser pixel's Purchase.
    if (landing.metaPixelId && (await capiEnabled())) {
      const fbclid = clean(b.fbclid, 500);
      const fbc = req.cookies.get('_fbc')?.value || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined);
      const capi = await sendCapiPurchase({
        pixelId: landing.metaPixelId,
        eventId: order.id,
        eventSourceUrl: clean(b.pageUrl, 500) || req.headers.get('referer') || undefined,
        value: order.totalAmount,
        currency: landing.currency || 'COP',
        contentIds: [landing.id],
        contentName: landing.productName,
        numItems: order.units,
        customer: { name, phone, city, region: order.department, country: landing.country },
        client: {
          ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || undefined,
          userAgent: req.headers.get('user-agent') || undefined,
          fbp: req.cookies.get('_fbp')?.value,
          fbc,
        },
        externalId: phone.replace(/\D/g, ''),
      });
      await patchOrderData(order.id, { capi: { ok: capi.ok, error: capi.error, at: new Date().toISOString() } }).catch(() => {});
    }

    // WhatsApp order confirmation (template with "Confirmar pedido" / "Cancelar"). Never blocks the order.
    // Mode "customer writes first": no template now; optionally schedule one if they don't confirm in time.
    const wa = (await confirmTemplateEnabled()) ? await getWaSettings().catch(() => ({ mode: 'template' as const, fallbackMinutes: 0 })) : null;
    if (wa?.mode === 'customer_first' && wa.fallbackMinutes > 0) {
      await patchOrderData(order.id, { waFallbackAt: new Date(Date.now() + wa.fallbackMinutes * 60000).toISOString() }).catch(() => {});
    }
    if (wa?.mode === 'template') {
      const whatsapp = await sendOrderConfirmation(order, { currency: landing.currency, country: landing.country }).catch((e: any) => ({
        ok: false,
        error: e?.message || String(e),
        at: new Date().toISOString(),
      }));
      if (whatsapp) await patchOrderData(order.id, { whatsapp }).catch(() => {});
    }

    // AI confirmation call (Vapi): now, or scheduled by call hours / delay. Never blocks the order.
    await onNewOrder(order, req.nextUrl.origin);

    return NextResponse.json({ success: true, order });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}
