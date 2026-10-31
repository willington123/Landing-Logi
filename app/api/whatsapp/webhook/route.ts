import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { parseWebhook, verifySignature } from '@/lib/server/whatsapp';
import { noteWebhook } from '@/lib/server/wa-store';
import { isStoreVerifyToken, orgForWhatsAppNumber, waSecretsForNumber } from '@/lib/server/integrations';
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
  if (q.get('hub.mode') === 'subscribe' && (tokens.includes(given) || (cloudEnabled() && (await isStoreVerifyToken(given).catch(() => false))))) {
    return new NextResponse(q.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// One URL for every store. A notice signed with the Vercel number's or the platform app's secret is trusted
// as a whole; otherwise each number's notices are accepted only if the notice is signed with the app secret
// of the store that owns that number (stores that connected their own Meta app share this URL too).
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  const secrets = [env('WHATSAPP_APP_SECRET'), env('META_APP_SECRET')].filter(Boolean);
  const platformSigned = secrets.some((s) => verifySignature(raw, signature, s));
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: platformSigned ? 'invalid json' : 'invalid signature' }, { status: platformSigned ? 400 : 401 });
  }
  const { messages, statuses } = parseWebhook(body);
  if (!cloudEnabled()) {
    if (!platformSigned) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    return NextResponse.json({ ok: true, stored: false, messages: messages.length, statuses: statuses.length });
  }

  let unknown = 0;
  let accepted = 0;
  const groups = Array.from(byNumber(messages, statuses));
  for (const [phoneNumberId, group] of groups) {
    let org: string | null = null;
    if (platformSigned) {
      // Notices without a number (never sent by Meta, only by old test tools) go to the Vercel number's store.
      org = phoneNumberId ? await orgForWhatsAppNumber(phoneNumberId) : integrationsOrg();
    } else if (phoneNumberId) {
      const owner = await waSecretsForNumber(phoneNumberId);
      if (owner?.appSecret && verifySignature(raw, signature, owner.appSecret)) org = owner.orgId;
      else continue; // not signed by this number's app: ignore it
    }
    if (!org) {
      unknown += group.messages.length + group.statuses.length; // a number no store has connected
      continue;
    }
    accepted++;
    await processForOrg(org, group.messages, group.statuses);
  }
  if (!platformSigned && !accepted) {
    // Meta always signs; a signed notice that matches no app secret means a secret is wrong (shown in Integrations).
    if (signature) await runWithOrg(integrationsOrg(), () => noteWebhook({ lastInvalidAt: new Date().toISOString() }));
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, messages: messages.length, statuses: statuses.length, ...(unknown ? { ignored: unknown } : {}) });
}
