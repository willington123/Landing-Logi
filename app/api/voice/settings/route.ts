import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { publicBaseUrl, vapiStatus } from '@/lib/server/vapi';
import { getVoiceConfig, saveVoiceConfig } from '@/lib/server/voice-store';
import { DEFAULT_VOICE_CONFIG, sanitizeVoiceConfig } from '@/lib/voice-config';

export const dynamic = 'force-dynamic';

// Admin: AI call settings and connection status.
export async function GET(req: NextRequest) {
  const status = { ...(await vapiStatus()), cloud: cloudEnabled(), baseUrl: publicBaseUrl(req.nextUrl.origin) };
  if (!cloudEnabled()) return NextResponse.json({ success: true, config: DEFAULT_VOICE_CONFIG, status });
  try {
    return NextResponse.json({ success: true, config: await getVoiceConfig(), status });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, status }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const config = sanitizeVoiceConfig(await req.json().catch(() => ({})));
    await saveVoiceConfig(config);
    return NextResponse.json({ success: true, config });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
