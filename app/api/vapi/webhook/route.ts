import { NextRequest, NextResponse } from 'next/server';
import { integrationsOrg, runWithOrg } from '@/lib/server/tenant';
import { timingSafeEqual } from 'crypto';
import { cloudEnabled } from '@/lib/server/db';
import { rawDb } from '@/lib/server/supabase';
import { getVapiCall, parseToolCalls, webhookSecret } from '@/lib/server/vapi';
import { applyToolResult, finalizeCall } from '@/lib/server/voice-actions';
import { getCallByVapiId, updateCall } from '@/lib/server/voice-store';

export const dynamic = 'force-dynamic';

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Server messages from Vapi: status updates, tool calls ("registrar_resultado") and end-of-call reports.
// Only calls created by this app (known vapi_call_id) are processed.
// Each call belongs to the store that placed it: the notice is handled inside that store,
// and checked with that store's Vapi secret.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ ok: true, stored: false });
  const body = await req.json().catch(() => null);
  const m = body?.message;
  const vapiCallId = typeof m?.call?.id === 'string' ? m.call.id : '';
  if (!m?.type || !vapiCallId) return NextResponse.json({ ok: true });
  const { data } = await rawDb().from('calls').select('org_id').eq('vapi_call_id', vapiCallId).maybeSingle();
  const org = (data?.org_id as string) || integrationsOrg();
  return runWithOrg(org, () => handle(req, m, vapiCallId));
}

async function handle(req: NextRequest, m: any, vapiCallId: string) {
  const secret = await webhookSecret();
  if (secret && !sameSecret(req.headers.get('x-logipages-secret') || '', secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    if (m.type === 'tool-calls') {
      const results = parseToolCalls(m);
      const call = await getCallByVapiId(vapiCallId);
      let trusted = Boolean(call);
      // Without a shared secret, confirm with Vapi that this call really is live.
      if (call && !secret) {
        const v = await getVapiCall(vapiCallId).catch(() => null);
        trusted = Boolean(v && v.status !== 'ended');
      }
      const out = [];
      for (const r of results) {
        if (!call || !trusted) out.push({ toolCallId: r.toolCallId, error: 'Llamada desconocida.' });
        else out.push({ toolCallId: r.toolCallId, result: await applyToolResult(call, r) });
      }
      return NextResponse.json({ results: out });
    }

    if (m.type === 'status-update') {
      const call = await getCallByVapiId(vapiCallId);
      if (call && typeof m.status === 'string' && m.status !== 'ended' && call.status !== 'ended') {
        await updateCall(call.id, { status: m.status, ...(m.status === 'in-progress' && !call.started_at ? { started_at: new Date().toISOString() } : {}) });
      }
      return NextResponse.json({ ok: true });
    }

    if (m.type === 'end-of-call-report') {
      await finalizeCall(vapiCallId);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    // Logged, not returned: Vapi does not need our internals.
    console.error('Vapi webhook', m.type, vapiCallId, e);
    if (m.type === 'tool-calls') {
      return NextResponse.json({ results: parseToolCalls(m).map((r) => ({ toolCallId: r.toolCallId, error: 'No se pudo guardar el resultado.' })) });
    }
  }
  return NextResponse.json({ ok: true });
}
