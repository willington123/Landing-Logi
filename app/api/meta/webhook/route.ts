import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { verifySignature } from '@/lib/server/whatsapp';
import { runWithOrg } from '@/lib/server/tenant';
import { applySocialReceipt, handleComment, handleSocialMessage, orgForAsset, parseSocialMessaging, parseSocialReceipts, parseSocialWebhook } from '@/lib/server/social';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const env = (k: string) => (process.env[k] || '').trim();

// Facebook Page and Instagram notices (comments) for every store, through the platform's Meta app.
// In the Meta app: Webhooks → Page (fields "feed", "messages", "message_deliveries", "message_reads") and Instagram
// ("comments", "messages", "messaging_seen") → this URL.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const tokens = [env('META_VERIFY_TOKEN'), env('WHATSAPP_VERIFY_TOKEN')].filter(Boolean);
  if (q.get('hub.mode') === 'subscribe' && tokens.includes(q.get('hub.verify_token') || '')) {
    return new NextResponse(q.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = env('META_APP_SECRET') || env('WHATSAPP_APP_SECRET');
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'), secret)) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!cloudEnabled()) return NextResponse.json({ ok: true, stored: false });
  const comments = parseSocialWebhook(body);
  let handled = 0;
  for (const c of comments) {
    const org = await orgForAsset(c.channel === 'facebook' ? 'page' : 'ig', c.assetId);
    if (!org) continue; // a page no store has turned on
    const r = await runWithOrg(org, () => handleComment(c));
    if (r) handled++;
  }
  // Messenger / Instagram Direct messages → Mensajes.
  const chats = parseSocialMessaging(body);
  for (const ev of chats) {
    const org = await orgForAsset(ev.kind, ev.assetId);
    if (!org) continue;
    await runWithOrg(org, () => handleSocialMessage(ev)).catch((e) => console.error('Messenger/Instagram:', e));
  }
  // "Delivered" / "read" → ✓✓ in Mensajes.
  const receipts = parseSocialReceipts(body);
  for (const r of receipts) {
    const org = await orgForAsset(r.kind, r.assetId);
    if (!org) continue;
    await runWithOrg(org, () => applySocialReceipt(r)).catch((e) => console.error('Messenger/Instagram (recibos):', e));
  }
  return NextResponse.json({ ok: true, comments: comments.length, handled, messages: chats.length, receipts: receipts.length });
}
