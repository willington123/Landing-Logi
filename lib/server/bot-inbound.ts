// When a customer writes: let the AI assistant answer (after a short pause, so several messages get one reply).
import { getConversationAds } from '@/lib/server/crm-store';
import type { AdRef } from '@/lib/ads';
import { waitUntil } from '@vercel/functions';
import { db } from '@/lib/server/db';
import { sendText, whatsappEnabled, type InboundMessage } from '@/lib/server/whatsapp';
import { markConversationRead, recordOutbound } from '@/lib/server/wa-store';
import { addConversationTags, addNote, getAutoSettings, getTags } from '@/lib/server/crm-store';
import { botConfigured, chatHistory, getBotSettings, getBotState, runBot, setBotState } from '@/lib/server/bot';
import { findTag, isOrderTag, isWorkingTime, type CrmTag } from '@/lib/crm';
import { shouldResume } from '@/lib/bot';
import { autoAssign } from '@/lib/server/crm-store';

const DEBOUNCE_MS = Number(process.env.BOT_DEBOUNCE_MS ?? 4000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// Tag the chat when the assistant hands it over (the store's tag with that id or name, if it has one).
const HANDOFF_TAG: Record<string, [string, string[]]> = {
  reclamo: ['reclamo', ['Reclamo', 'Reclamos', 'Queja']],
  cambio_pedido: ['cambio-direccion', ['Cambio de dirección', 'Cambio de pedido', 'Cambio']],
  cancelacion: ['reclamo', ['Cancelación', 'Cancelado', 'Reclamo']],
};
async function addTag(phone: string, pick: (tags: CrmTag[]) => CrmTag | null) {
  const tag = pick(await getTags());
  if (tag) await addConversationTags({ [phone]: [tag.id] });
}

// true = the assistant takes this message (the keyword/out-of-hours replies are skipped).
export async function botTakesMessage(m: InboundMessage, fallback: () => Promise<unknown>): Promise<boolean> {
  const social = /^[mi]\d/.test(m.from); // Messenger / Instagram chat
  if (!(await botConfigured()) || (!social && !(await whatsappEnabled()))) return false;
  const settings = await getBotSettings();
  if (!settings.enabled || (social && !settings.social)) return false;
  if (settings.mode === 'away') {
    const auto = await getAutoSettings();
    if (isWorkingTime(auto.away, auto.timezone, new Date(m.timestamp))) return false;
  }
  const state = await getBotState(m.from);
  if (state.paused) {
    // A person is handling this chat, unless nobody has written in it for the hours the store chose.
    if (!shouldResume(state, settings)) return false;
    const hours = settings.resumeAfterHours;
    await setBotState(m.from, { paused: false, pausedAt: undefined, reason: undefined, note: undefined });
    await addNote(m.from, `🤖 El asistente volvió a atender este chat: nadie del equipo escribió en ${hours} ${hours === 1 ? 'hora' : 'horas'}.`).catch(() => {});
  }
  // Answer after the webhook has replied to Meta.
  waitUntil(
    answer(m).catch(async (e) => {
      console.error('Asistente IA: error', e);
      await setBotState(m.from, { paused: false, reason: 'error', note: String(e?.message || e).slice(0, 200) }).catch(() => {});
      await fallback().catch(() => {});
    }),
  );
  return true;
}

async function isLatestInbound(conversationId: string, waMessageId: string) {
  const { data } = await (await db())
    .from('wa_messages')
    .select('wa_message_id')
    .eq('conversation_id', conversationId)
    .eq('direction', 'in')
    .order('created_at', { ascending: false })
    .limit(1);
  return !data?.[0] || data[0].wa_message_id === waMessageId;
}

async function answer(m: InboundMessage) {
  if (DEBOUNCE_MS > 0) await sleep(DEBOUNCE_MS);
  // A newer message arrived: its run answers everything together.
  if (!(await isLatestInbound(m.from, m.waMessageId))) return;
  const settings = await getBotSettings();
  let state = await getBotState(m.from);
  if (!settings.enabled || state.paused) return;

  const day = today();
  const replies = state.day === day ? state.replies || 0 : 0;
  if (replies >= settings.maxRepliesPerDay) {
    await setBotState(m.from, { paused: true, pausedAt: new Date().toISOString(), reason: 'limit', note: 'Límite diario de respuestas del asistente.' });
    await autoAssign(m.from, 'handoff').catch(() => null);
    return;
  }

  let ad: { headline?: string; body?: string } | null = m.ad || (await getConversationAds().catch(() => ({}) as Record<string, AdRef>))[m.from] || null;
  // Messenger / Instagram chat that started from a comment: the post it was about.
  if (!ad && /^[mi]\d/.test(m.from)) {
    const meta = await (await import('@/lib/server/social')).chatMeta(m.from).catch(() => null);
    if (meta?.post) ad = { headline: meta.product || undefined, body: meta.post };
  }
  const run = await runBot({ settings, phone: m.from, customerName: m.profileName, ad, history: await chatHistory(m.from) });

  if (run.reply) {
    const result = await sendText(m.from, run.reply);
    // A handed-over chat stays in "Sin responder" for the team.
    await recordOutbound({ phone: m.from, type: 'bot', body: run.reply, result, auto: Boolean(run.handoff) });
    // The assistant answered: the chat no longer counts as unread for the team (unless it was handed to a person,
    // the reply failed, or the customer wrote again meanwhile).
    if (result.ok && !run.handoff && (await isLatestInbound(m.from, m.waMessageId))) await markConversationRead(m.from).catch(() => {});
  }
  state = await setBotState(m.from, { day, replies: replies + (run.reply ? 1 : 0), ...(run.handoff ? {} : { reason: undefined, note: undefined }) });

  if (run.booked) await addNote(m.from, `📅 El asistente agendó una cita: ${run.booked}.`).catch(() => {});

  if (run.order) {
    await addNote(m.from, `🛒 El asistente tomó el pedido ${run.order} (confirmado en el chat).`).catch(() => {});
    await addTag(m.from, (tags) => tags.find(isOrderTag) || null).catch(() => {});
  }

  if (run.handoff) {
    await setBotState(m.from, { paused: true, pausedAt: new Date().toISOString(), reason: 'handoff', note: run.handoff.motivo });
    await autoAssign(m.from, 'handoff').catch(() => null);
    await addNote(m.from, `🤖 El asistente pasó el chat a una persona: ${run.handoff.motivo}`).catch(() => {});
    const want = HANDOFF_TAG[run.handoff.tipo];
    if (want) await addTag(m.from, (tags) => findTag(tags, want[0], want[1])).catch(() => {});
  }
}
