import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { parseWebhook, verifySignature, verifyToken } from '@/lib/server/whatsapp';
import { handleInbound } from '@/lib/server/wa-actions';
import { applyStatus, noteWebhook } from '@/lib/server/wa-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // the AI assistant answers right after the reply to Meta

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
  const signature = req.headers.get('x-hub-signature-256');
  if (!verifySignature(raw, signature)) {
    // Meta always signs; a signed notice that fails means WHATSAPP_APP_SECRET is wrong (shown in Integrations).
    if (signature && cloudEnabled()) await noteWebhook({ lastInvalidAt: new Date().toISOString() });
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
  let lastError: string | undefined;
  const fail = (what: string, id: string) => (e: any) => {
    console.error(`WhatsApp webhook: ${what}`, id, e);
    lastError = e?.message || String(e);
  };
  for (const m of messages) await handleInbound(m).catch(fail('mensaje', m.waMessageId));
  for (const s of statuses) await applyStatus(s).catch(fail('estado', s.waMessageId));
  const now = new Date().toISOString();
  await noteWebhook({ lastOkAt: now, lastMessages: messages.length, lastStatuses: statuses.length, ...(lastError ? { lastErrorAt: now, lastError: lastError.slice(0, 300) } : {}) });
  return NextResponse.json({ ok: true, messages: messages.length, statuses: statuses.length });
}
