import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, getSettings, saveSettings } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    return NextResponse.json({ success: true, settings: await getSettings() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    await saveSettings(await req.json());
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}
