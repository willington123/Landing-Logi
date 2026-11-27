import { NextRequest, NextResponse } from 'next/server';
import { runWithOrg } from '@/lib/server/tenant';
import { rawDb } from '@/lib/server/supabase';
import { waitUntil } from '@vercel/functions';
import { getShopifySettings, handleShopifyEvent, logDelivery, processCarts, validShopifySignature } from '@/lib/server/shopify-carts';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // short waits (2–4 min) are timed from here

// Shopify → Konnexa: checkouts (abandoned carts) and orders of one store. Signed with the store's webhook key.
export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const org = String(params.orgId || '');
  if (!/^[\w-]{1,80}$/.test(org)) return NextResponse.json({ ok: false }, { status: 404 });
  const { data } = await rawDb().from('organizations').select('id').eq('id', org).maybeSingle();
  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await req.text();
  return runWithOrg(org, async () => {
    const s = await getShopifySettings();
    const topic = req.headers.get('x-shopify-topic') || '';
    let ref = '';
    try {
      const b = JSON.parse(raw);
      ref = String(b?.name || b?.token || b?.id || '').slice(0, 40);
    } catch {}
    if (!validShopifySignature(raw, req.headers.get('x-shopify-hmac-sha256'), s.secret)) {
      await logDelivery({ topic, ref, ok: false, result: 'Firma no válida: la clave guardada en Konnexa no es la de Shopify (Notificaciones → Webhooks → «Tus webhooks se firmarán con…»).' }).catch(() => {});
      return NextResponse.json({ ok: false, error: 'firma no válida' }, { status: 401 });
    }
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const r = await handleShopifyEvent(topic, body).catch((e) => {
      console.error('Shopify webhook', topic, e);
      return { kept: false, why: `Error: ${String(e?.message || e).slice(0, 150)}` };
    });
    await logDelivery({ topic, ref, ok: r.kept || !/^Error/.test(r.why), result: r.why }).catch(() => {});
    // The scheduled task runs every few minutes; for a short wait, the message goes right when it ends.
    if (r.kept && s.enabled && s.delayMinutes <= 4)
      waitUntil(
        new Promise((done) => setTimeout(done, s.delayMinutes * 60000 + 5000)).then(() =>
          runWithOrg(org, () => processCarts(new Date(), org)).catch((e) => console.error('Carritos Shopify (espera corta)', e)),
        ),
      );
    return NextResponse.json({ ok: true });
  });
}
