import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, createOrder, getPublicLanding, patchOrderData } from '@/lib/server/db';
import { capiEnabled, sendCapiPurchase } from '@/lib/server/meta-capi';
import { confirmTemplateEnabled } from '@/lib/server/whatsapp';
import { sendOrderConfirmation } from '@/lib/server/wa-actions';
import type { OrderItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

// Public endpoint used by landing pages to place cash-on-delivery orders.
// Price and product come from the stored landing, never from the browser.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const b = await req.json();
    const landing = await getPublicLanding(clean(b.landingId, 120));
    if (!landing) return NextResponse.json({ success: false, error: 'Landing no encontrada.' }, { status: 404 });

    const units = Number(b.units) || 0;
    const combo = landing.combos.find((c) => c.units === units) || landing.combos[0];
    const name = clean(b.customerName, 120);
    const phone = clean(b.phone, 40);
    const city = clean(b.city, 80);
    const address = clean(b.address, 240);
    if (!name || phone.replace(/\D/g, '').length < 7 || !city || !address || !combo) {
      return NextResponse.json({ success: false, error: 'Faltan datos del pedido.' }, { status: 400 });
    }

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
    if (capiEnabled() && landing.metaPixelId) {
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
    if (confirmTemplateEnabled()) {
      const whatsapp = await sendOrderConfirmation(order, { currency: landing.currency, country: landing.country }).catch((e: any) => ({
        ok: false,
        error: e?.message || String(e),
        at: new Date().toISOString(),
      }));
      if (whatsapp) await patchOrderData(order.id, { whatsapp }).catch(() => {});
    }

    return NextResponse.json({ success: true, order });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
