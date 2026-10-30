import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { setBotState } from '@/lib/server/bot';

export const dynamic = 'force-dynamic';

// Admin: take over a chat (the assistant stops) or hand it back. Body: { action: 'pause' | 'resume' }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!/^\d{6,20}$/.test(params.id)) return NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 });
  try {
    const { action } = await req.json().catch(() => ({}));
    const state =
      action === 'resume'
        ? await setBotState(params.id, { paused: false, pausedAt: undefined, reason: undefined, note: undefined })
        : await setBotState(params.id, { paused: true, pausedAt: new Date().toISOString(), reason: 'human', note: undefined });
    return NextResponse.json({ success: true, paused: Boolean(state.paused) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
