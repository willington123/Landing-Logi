import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { getWaSettings, saveWaSettings } from '@/lib/server/wa-store';

export const dynamic = 'force-dynamic';

// Admin: how orders get confirmed on WhatsApp (customer writes first, or automatic template) and the fallback delay.
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: true, mode: 'template', fallbackMinutes: 0 });
  try {
    return NextResponse.json({ success: true, ...(await getWaSettings()) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  if (body.mode !== undefined && body.mode !== 'customer_first' && body.mode !== 'template') {
    return NextResponse.json({ success: false, error: 'Modo no válido.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ success: true, ...(await saveWaSettings(body)) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
