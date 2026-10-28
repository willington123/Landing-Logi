import { NextResponse } from 'next/server';
import { cloudEnabled, listOrders } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    return NextResponse.json({ success: true, orders: await listOrders() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
