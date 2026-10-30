import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { getAutoSettings, saveAutoSettings } from '@/lib/server/crm-store';
import { cleanAuto, isWorkingTime } from '@/lib/crm';

export const dynamic = 'force-dynamic';

const noDb = () => NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });

// Admin: WhatsApp automatic replies (keywords and out-of-hours message).
export async function GET() {
  if (!cloudEnabled()) return noDb();
  try {
    const settings = await getAutoSettings();
    return NextResponse.json({ success: true, settings, workingNow: isWorkingTime(settings.away, settings.timezone) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}

// Body: { settings: AutoSettings }.
export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return noDb();
  try {
    const { settings } = await req.json().catch(() => ({}));
    const clean = cleanAuto(settings);
    if (typeof clean === 'string') return NextResponse.json({ success: false, error: clean }, { status: 400 });
    await saveAutoSettings(clean);
    return NextResponse.json({ success: true, settings: clean, workingNow: isWorkingTime(clean.away, clean.timezone) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
