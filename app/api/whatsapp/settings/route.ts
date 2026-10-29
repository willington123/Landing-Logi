import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { getWaMode, saveWaMode } from '@/lib/server/wa-store';

export const dynamic = 'force-dynamic';

// Admin: how orders get confirmed on WhatsApp (customer writes first, or automatic template).
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: true, mode: 'template' });
  try {
    return NextResponse.json({ success: true, mode: await getWaMode() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  const { mode } = await req.json().catch(() => ({}));
  if (mode !== 'customer_first' && mode !== 'template') return NextResponse.json({ success: false, error: 'Modo no válido.' }, { status: 400 });
  try {
    await saveWaMode(mode);
    return NextResponse.json({ success: true, mode });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
