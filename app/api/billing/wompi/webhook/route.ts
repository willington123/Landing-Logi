import { NextRequest, NextResponse } from 'next/server';
import { applyTransaction, validEvent } from '@/lib/server/billing';
import { cloudEnabled } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

// Wompi events (set this URL in Wompi → Desarrolladores → URL de eventos). Checked with the events secret.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !validEvent(body)) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  if (!cloudEnabled()) return NextResponse.json({ ok: true });
  if (body.event === 'transaction.updated' && body.data?.transaction?.reference) {
    try {
      const r = await applyTransaction(body.data.transaction);
      return NextResponse.json({ ok: true, status: r.status, applied: r.applied });
    } catch (e: any) {
      console.error('Wompi webhook', e);
      return NextResponse.json({ error: 'retry' }, { status: 500 }); // Wompi retries
    }
  }
  return NextResponse.json({ ok: true });
}
