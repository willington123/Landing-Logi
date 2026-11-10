import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, patchOrderData, updateOrderAddress, updateOrderStatus } from '@/lib/server/db';
import type { OrderStatus } from '@/lib/types';
import { getAgents, myAgent } from '@/lib/server/crm-store';
import { getUser } from '@/lib/server/accounts';
import { sessionUserId } from '@/lib/server/tenant';

export const dynamic = 'force-dynamic';

async function whoAmI(): Promise<string | null> {
  const uid = sessionUserId();
  if (!uid) return null;
  const agent = await myAgent(await getAgents()).catch(() => null);
  if (agent) return agent.name;
  const user = await getUser(uid).catch(() => null);
  return (user?.name || user?.email?.split('@')[0] || null)?.slice(0, 60) || null;
}

const STATUSES: OrderStatus[] = ['pending_call', 'calling', 'confirmed_by_voice', 'needs_review', 'unanswered', 'retry_scheduled', 'cancelled', 'shipped', 'delivered', 'returned'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const body = await req.json().catch(() => ({}));
    const { status } = body;
    // "Ya está en Dropi", marked by hand: { inDropi: boolean, dropiRef? }
    if (status === undefined && body.inDropi !== undefined) {
      const inDropi = body.inDropi
        ? { at: new Date().toISOString(), by: await whoAmI(), ref: String(body.dropiRef ?? '').trim().slice(0, 40) || null }
        : null;
      await patchOrderData(params.id, { inDropi });
      return NextResponse.json({ success: true, inDropi });
    }
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
    // Shipping details given with "Marcar enviado" (saved first, so flows on "Enviado" have the tracking number).
    if (status === 'shipped' && (body.carrier !== undefined || body.trackingNumber !== undefined)) {
      await patchOrderData(params.id, {
        carrier: String(body.carrier ?? '').trim().slice(0, 60) || null,
        trackingNumber: String(body.trackingNumber ?? '').trim().slice(0, 60) || null,
        shippedAt: new Date().toISOString(),
      });
    }
    await updateOrderStatus(params.id, status);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
