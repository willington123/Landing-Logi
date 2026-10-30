// Processes WhatsApp webhook notices inside the store that owns the receiving number.
import { handleInbound } from '@/lib/server/wa-actions';
import { applyStatus, noteWebhook } from '@/lib/server/wa-store';
import { runWithOrg } from '@/lib/server/tenant';
import type { InboundMessage, StatusUpdate } from '@/lib/server/whatsapp';

export async function processForOrg(orgId: string, messages: InboundMessage[], statuses: StatusUpdate[]) {
  return runWithOrg(orgId, async () => {
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
  });
}

// Groups notices by the number that received them.
export function byNumber(messages: InboundMessage[], statuses: StatusUpdate[]) {
  const groups = new Map<string, { messages: InboundMessage[]; statuses: StatusUpdate[] }>();
  const get = (id: string) => groups.get(id) || (groups.set(id, { messages: [], statuses: [] }), groups.get(id)!);
  for (const m of messages) get(m.phoneNumberId || '').messages.push(m);
  for (const s of statuses) get(s.phoneNumberId || '').statuses.push(s);
  return groups;
}
