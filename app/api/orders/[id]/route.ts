import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, updateOrderStatus } from '@/lib/server/db';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: OrderStatus[] = ['pending_call', 'calling', 'confirmed_by_voice', 'needs_review', 'unanswered', 'retry_scheduled', 'cancelled', 'shipped', 'delivered'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const { status } = await req.json();
    if (!STATUSES.includes(status)) return NextResponse.json({ success: false, error: 'Estado inválido.' }, { status: 400 });
    await updateOrderStatus(params.id, status);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
