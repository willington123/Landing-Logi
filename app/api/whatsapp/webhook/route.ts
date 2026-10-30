import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { parseWebhook, verifySignature } from '@/lib/server/whatsapp';
import { noteWebhook } from '@/lib/server/wa-store';
import { orgForWhatsAppNumber } from '@/lib/server/integrations';
import { integrationsOrg, runWithOrg } from '@/lib/server/tenant';
import { byNumber, processForOrg } from '@/lib/server/wa-webhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // the AI assistant answers right after the reply to Meta

const env = (k: string) => (process.env[k] || '').trim();

// Shared webhook for the number in Vercel and for stores connected through the platform's Meta app
// (Embedded Signup). Stores that use their own Meta app have their own URL: /api/whatsapp/webhook/<store>.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const tokens = [env('WHATSAPP_VERIFY_TOKEN'), env('META_VERIFY_TOKEN')].filter(Boolean);
  const given = q.get('hub.verify_token') || '';
  if (q.get('hub.mode') === 'subscribe' && tokens.includes(given)) {
    return new NextResponse(q.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// Signed with the Vercel number's app secret or the platform app's secret; each notice goes to the store of its number.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  const secrets = [env('WHATSAPP_APP_SECRET'), env('META_APP_SECRET')].filter(Boolean);
  if (!secrets.some((s) => verifySignature(raw, signature, s))) {
    // Meta always signs; a signed notice that fails means the app secret is wrong (shown in Integrations).
    if (signature && cloudEnabled()) await runWithOrg(integrationsOrg(), () => noteWebhook({ lastInvalidAt: new Date().toISOString() }));
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

  let unknown = 0;
  for (const [phoneNumberId, group] of Array.from(byNumber(messages, statuses))) {
    // Notices without a number (never sent by Meta, only by old test tools) go to the Vercel number's store.
    const org = phoneNumberId ? await orgForWhatsAppNumber(phoneNumberId) : integrationsOrg();
    if (!org) {
      unknown += group.messages.length + group.statuses.length; // a number no store has connected
      continue;
    }
    await processForOrg(org, group.messages, group.statuses);
  }
  return NextResponse.json({ ok: true, messages: messages.length, statuses: statuses.length, ...(unknown ? { ignored: unknown } : {}) });
}
