import { NextRequest, NextResponse } from 'next/server';
import { runWithOrg } from '@/lib/server/tenant';
import { rawDb } from '@/lib/server/supabase';
import { getShopifySettings, handleShopifyEvent, validShopifySignature } from '@/lib/server/shopify-carts';

export const dynamic = 'force-dynamic';

// Shopify → Konnexa: checkouts (abandoned carts) and orders of one store. Signed with the store's webhook key.
export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const org = String(params.orgId || '');
  if (!/^[\w-]{1,80}$/.test(org)) return NextResponse.json({ ok: false }, { status: 404 });
  const { data } = await rawDb().from('organizations').select('id').eq('id', org).maybeSingle();
  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await req.text();
  return runWithOrg(org, async () => {
    const s = await getShopifySettings();
    if (!validShopifySignature(raw, req.headers.get('x-shopify-hmac-sha256'), s.secret)) return NextResponse.json({ ok: false, error: 'firma no válida' }, { status: 401 });
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const topic = req.headers.get('x-shopify-topic') || '';
    await handleShopifyEvent(topic, body).catch((e) => console.error('Shopify webhook', topic, e));
    return NextResponse.json({ ok: true });
  });
}
