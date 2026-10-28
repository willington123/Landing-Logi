import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { parseWebhook, verifySignature, verifyToken } from '@/lib/server/whatsapp';
import { handleInbound } from '@/lib/server/wa-actions';
import { applyStatus } from '@/lib/server/wa-store';

export const dynamic = 'force-dynamic';

// Meta webhook verification: echo hub.challenge when the verify token matches.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const token = verifyToken();
  if (token && q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === token) {
    return new NextResponse(q.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// Incoming messages and delivery statuses. Only requests signed with the app secret are accepted.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const { messages, statuses } = parseWebhook(body);
  if (!cloudEnabled()) return NextResponse.json({ ok: true, stored: false, messages: messages.length, statuses: statuses.length });

  // Errors are logged, not returned: a non-200 makes Meta retry the same batch.
  for (const m of messages) await handleInbound(m).catch((e) => console.error('WhatsApp webhook: mensaje', m.waMessageId, e));
  for (const s of statuses) await applyStatus(s).catch((e) => console.error('WhatsApp webhook: estado', s.waMessageId, e));
  return NextResponse.json({ ok: true, messages: messages.length, statuses: statuses.length });
}
