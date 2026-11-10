import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { botConfigured, getBotSettings, saveBotSettings } from '@/lib/server/bot';
import { cleanBot } from '@/lib/bot';
import { followUpStats } from '@/lib/server/followup';
import { sellables } from '@/lib/server/products';

export const dynamic = 'force-dynamic';

const noDb = () => NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });

// Admin: AI assistant settings. "configured" tells whether ANTHROPIC_API_KEY is set (the key itself never leaves the server).
export async function GET() {
  if (!cloudEnabled()) return noDb();
  try {
    // The prices the assistant quotes and charges: the offers of the published landings and WhatsApp products.
    const prices = (await sellables(20).catch(() => []))
      .map((l) => ({
        id: l.id,
        name: l.productName || l.title || 'Producto',
        kind: l.kind === 'product' ? 'product' : 'landing',
        offers: (l.combos || []).filter((c) => c.promoPrice > 0).map((c) => ({ name: c.name, units: c.units, price: c.promoPrice, regular: c.regularPrice > c.promoPrice ? c.regularPrice : null })),
      }))
      .filter((p) => p.offers.length);
    return NextResponse.json({ success: true, settings: await getBotSettings(), configured: await botConfigured(), followUpStats: await followUpStats().catch(() => null), prices });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}

// Body: { settings }.
export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return noDb();
  try {
    const { settings } = await req.json().catch(() => ({}));
    const clean = cleanBot(settings);
    if (typeof clean === 'string') return NextResponse.json({ success: false, error: clean }, { status: 400 });
    if (clean.enabled && !(await botConfigured()))
      return NextResponse.json({ success: false, error: 'Falta la clave de Claude: conéctala en Integraciones → Claude (Anthropic) para activar el asistente.' }, { status: 400 });
    await saveBotSettings(clean);
    return NextResponse.json({ success: true, settings: clean, configured: await botConfigured() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
