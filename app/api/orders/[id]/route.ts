import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, patchOrderData, updateOrderAddress, updateOrderStatus } from '@/lib/server/db';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: OrderStatus[] = ['pending_call', 'calling', 'confirmed_by_voice', 'needs_review', 'unanswered', 'retry_scheduled', 'cancelled', 'shipped', 'delivered'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const body = await req.json().catch(() => ({}));
    const { status } = body;
    // Address correction (from Mensajes): { address, city, department? }
    if (status === undefined && body.address !== undefined) {
      const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
      const address = clean(body.address, 240);
      const city = clean(body.city, 80);
      if (address.length < 6 || !city) return NextResponse.json({ success: false, error: 'Escribe la dirección completa y la ciudad.' }, { status: 400 });
      const order = await updateOrderAddress(params.id, { address, city, department: clean(body.department, 80) });
      if (!order) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 });
      return NextResponse.json({ success: true, order });
    }
    if (!STATUSES.includes(status)) return NextResponse.json({ success: false, error: 'Estado inválido.' }, { status: 400 });
    await updateOrderStatus(params.id, status);
    // Shipping details given with "Marcar enviado".
    if (status === 'shipped' && (body.carrier !== undefined || body.trackingNumber !== undefined)) {
      await patchOrderData(params.id, {
        carrier: String(body.carrier ?? '').trim().slice(0, 60) || null,
        trackingNumber: String(body.trackingNumber ?? '').trim().slice(0, 60) || null,
        shippedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}
