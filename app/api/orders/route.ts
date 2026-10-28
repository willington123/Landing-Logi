import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, deleteOrders, listOrders } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    return NextResponse.json({ success: true, orders: await listOrders() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// Admin: delete one or more orders. Body: { ids: string[] }.
export async function DELETE(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const { ids } = await req.json().catch(() => ({}));
    const valid = Array.isArray(ids) ? Array.from(new Set(ids.filter((id) => typeof id === 'string' && /^[\w-]{1,80}$/.test(id)))) : [];
    if (!valid.length || valid.length > 1000) return NextResponse.json({ success: false, error: 'No hay pedidos válidos para eliminar.' }, { status: 400 });
    const deleted = await deleteOrders(valid);
    return NextResponse.json({ success: true, deleted });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
