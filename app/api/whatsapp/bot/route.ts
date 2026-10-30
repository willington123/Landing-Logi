import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { botConfigured, getBotSettings, saveBotSettings } from '@/lib/server/bot';
import { cleanBot } from '@/lib/bot';

export const dynamic = 'force-dynamic';

const noDb = () => NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });

// Admin: AI assistant settings. "configured" tells whether ANTHROPIC_API_KEY is set (the key itself never leaves the server).
export async function GET() {
  if (!cloudEnabled()) return noDb();
  try {
    return NextResponse.json({ success: true, settings: await getBotSettings(), configured: await botConfigured() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
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
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}
