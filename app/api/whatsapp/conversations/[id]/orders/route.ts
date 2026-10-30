import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, listOrders } from '@/lib/server/db';
import { samePhone } from '@/lib/server/wa-store';

export const dynamic = 'force-dynamic';

// Admin: every order placed with this customer's phone (newest first).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!/^\d{6,20}$/.test(params.id)) return NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 });
  try {
    const orders = (await listOrders(1000))
      .filter((o) => samePhone(o, params.id))
      .map((o) => ({ id: o.id, orderNumber: o.orderNumber, productName: o.productName, comboName: o.comboName, totalAmount: o.totalAmount, status: o.status, city: o.city, createdAt: o.createdAt }));
    return NextResponse.json({ success: true, orders });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
