import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, listLandings, upsertLanding } from '@/lib/server/db';
import type { LandingPageConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const off = () => NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });

export async function GET() {
  if (!cloudEnabled()) return off();
  try {
    return NextResponse.json({ success: true, landings: await listLandings() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}

// Saves a landing. Base64 images are uploaded to Storage; `replaced` maps each
// uploaded data URL to its public URL so the editor can swap them in place.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return off();
  try {
    const landing = (await req.json()) as LandingPageConfig;
    if (!landing?.id || !landing?.slug) {
      return NextResponse.json({ success: false, error: 'Landing inválida.' }, { status: 400 });
    }
    const { landing: saved, replaced } = await upsertLanding(landing);
    return NextResponse.json({ success: true, landing: saved, replaced });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}
