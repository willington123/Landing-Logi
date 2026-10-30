import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, db } from '@/lib/server/db';
import { confirmTemplateEnabled } from '@/lib/server/whatsapp';
import { sendConfirmationForOrder } from '@/lib/server/wa-actions';
import type { OrderItem, OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Admin: send the confirmation template for one order now (button in Pedidos). Body: { orderId }.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!(await confirmTemplateEnabled())) return NextResponse.json({ success: false, error: 'Configura WhatsApp y la plantilla de confirmación en Integraciones.' }, { status: 503 });
  const { orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string' || !/^[\w-]{1,80}$/.test(orderId)) return NextResponse.json({ success: false, error: 'Pedido no válido.' }, { status: 400 });
  try {
    const { data } = await (await db()).from('orders').select('data, status').eq('id', orderId).maybeSingle();
    if (!data) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 });
    const order = { ...(data.data as OrderItem), status: data.status as OrderStatus };
    const r = await sendConfirmationForOrder(order);
    if (!r?.ok) return NextResponse.json({ success: false, error: `WhatsApp no lo envió: ${r?.error || 'error desconocido'}` }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}
