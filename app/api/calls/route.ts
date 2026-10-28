import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { startOrderCall } from '@/lib/server/voice-actions';
import { listCalls } from '@/lib/server/voice-store';

export const dynamic = 'force-dynamic';

// Admin: call history (newest first).
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    return NextResponse.json({ success: true, calls: await listCalls() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// Admin: call the customer of an order now. Body: { orderId }.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const { orderId } = await req.json().catch(() => ({}));
    if (typeof orderId !== 'string' || !/^[\w-]{1,80}$/.test(orderId)) return NextResponse.json({ success: false, error: 'Pedido no válido.' }, { status: 400 });
    const r = await startOrderCall(orderId, { manual: true, origin: req.nextUrl.origin });
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 409 });
    return NextResponse.json({ success: true, callId: r.callId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
