import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { cloudEnabled } from '@/lib/server/db';
import { botConfigured, runBot } from '@/lib/server/bot';
import { cleanBot } from '@/lib/bot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin: try the assistant without WhatsApp (nothing is sent or saved).
// Body: { settings, history: [{ direction: 'in' | 'out', text }], phone? } - phone lets it look up that customer's orders.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!(await botConfigured())) return NextResponse.json({ success: false, error: 'Falta la clave de Claude: conéctala en Integraciones.' }, { status: 503 });
  try {
    const body = await req.json().catch(() => ({}));
    const settings = cleanBot({ ...(body.settings || {}), enabled: false });
    if (typeof settings === 'string') return NextResponse.json({ success: false, error: settings }, { status: 400 });
    const history = (Array.isArray(body.history) ? body.history : [])
      .slice(-30)
      .map((h: any) => ({ direction: h?.direction === 'out' ? 'out' : 'in', text: String(h?.text ?? '').slice(0, 2000) }) as const);
    if (!history.length || history[history.length - 1].direction !== 'in') return NextResponse.json({ success: false, error: 'Escribe un mensaje como cliente.' }, { status: 400 });
    const phone = String(body.phone || '').replace(/\D/g, '').slice(0, 15) || '570000000000';
    const run = await runBot({ settings, phone, customerName: 'Cliente de prueba', history, dryRun: true });
    return NextResponse.json({ success: true, ...run });
  } catch (e: any) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ success: false, error: 'La clave ANTHROPIC_API_KEY no es válida.' }, { status: 502 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ success: false, error: 'Demasiadas solicitudes a Claude en este momento. Intenta en un minuto.' }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ success: false, error: `Claude respondió con un error (${e.status}): ${e.message}` }, { status: 502 });
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
