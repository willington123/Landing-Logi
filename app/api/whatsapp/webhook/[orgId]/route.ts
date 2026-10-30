import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { parseWebhook, verifySignature } from '@/lib/server/whatsapp';
import { noteWebhook } from '@/lib/server/wa-store';
import { waConfig } from '@/lib/server/integrations';
import { runWithOrg } from '@/lib/server/tenant';
import { processForOrg } from '@/lib/server/wa-webhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const validOrg = (id: string) => /^org_[\w-]{2,40}$/.test(id);

// Webhook of a store that connected WhatsApp with its own Meta app (its verify token and app secret).
export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const q = req.nextUrl.searchParams;
  if (!cloudEnabled() || !validOrg(params.orgId)) return new NextResponse('Forbidden', { status: 403 });
  const cfg = await waConfig(params.orgId).catch(() => null);
  if (cfg?.verifyToken && q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === cfg.verifyToken) {
    return new NextResponse(q.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  if (!cloudEnabled() || !validOrg(params.orgId)) return NextResponse.json({ error: 'unknown store' }, { status: 404 });
  const raw = await req.text();
  const cfg = await waConfig(params.orgId).catch(() => null);
  if (!cfg) return NextResponse.json({ error: 'not connected' }, { status: 404 });
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'), cfg.appSecret)) {
    await runWithOrg(params.orgId, () => noteWebhook({ lastInvalidAt: new Date().toISOString() }));
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const { messages, statuses } = parseWebhook(body);
  // Only notices for this store's own number.
  const mine = (id?: string) => !id || id === cfg.phoneNumberId;
  await processForOrg(
    params.orgId,
    messages.filter((m) => mine(m.phoneNumberId)),
    statuses.filter((s) => mine(s.phoneNumberId)),
  );
  return NextResponse.json({ ok: true });
}
