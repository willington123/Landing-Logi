import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { startTestCall } from '@/lib/server/voice-actions';

export const dynamic = 'force-dynamic';

// Admin: test call with a sample order to the seller's own phone. Body: { phone }.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const { phone } = await req.json().catch(() => ({}));
    const r = await startTestCall(String(phone || '').slice(0, 30), req.nextUrl.origin);
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 409 });
    return NextResponse.json({ success: true, callId: r.callId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
