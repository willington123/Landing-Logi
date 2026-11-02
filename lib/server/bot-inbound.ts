// When a customer writes: let the AI assistant answer (after a short pause, so several messages get one reply).
import { getConversationAds } from '@/lib/server/crm-store';
import type { AdRef } from '@/lib/ads';
import { waitUntil } from '@vercel/functions';
import { db } from '@/lib/server/db';
import { sendText, whatsappEnabled, type InboundMessage } from '@/lib/server/whatsapp';
import { recordOutbound } from '@/lib/server/wa-store';
import { addNote, getAutoSettings, getConversationTags, getTags, setConversationTags } from '@/lib/server/crm-store';
import { botConfigured, chatHistory, getBotSettings, getBotState, runBot, setBotState } from '@/lib/server/bot';
import { isWorkingTime } from '@/lib/crm';

const DEBOUNCE_MS = Number(process.env.BOT_DEBOUNCE_MS ?? 4000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// Tag the chat when the assistant hands it over (only tags that exist).
const HANDOFF_TAG: Record<string, string> = { reclamo: 'reclamo', cambio_pedido: 'cambio-direccion', cancelacion: 'reclamo' };

// true = the assistant takes this message (the keyword/out-of-hours replies are skipped).
export async function botTakesMessage(m: InboundMessage, fallback: () => Promise<unknown>): Promise<boolean> {
  if (!(await botConfigured()) || !(await whatsappEnabled())) return false;
  const settings = await getBotSettings();
  if (!settings.enabled) return false;
  if (settings.mode === 'away') {
    const auto = await getAutoSettings();
    if (isWorkingTime(auto.away, auto.timezone, new Date(m.timestamp))) return false;
  }
  const state = await getBotState(m.from);
  if (state.paused) return false; // a person is handling this chat
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
    return;
  }

  const ad = m.ad || (await getConversationAds().catch(() => ({}) as Record<string, AdRef>))[m.from] || null;
  const run = await runBot({ settings, phone: m.from, customerName: m.profileName, ad, history: await chatHistory(m.from) });

  if (run.reply) {
    const result = await sendText(m.from, run.reply);
    // A handed-over chat stays in "Sin responder" for the team.
    await recordOutbound({ phone: m.from, type: 'bot', body: run.reply, result, auto: Boolean(run.handoff) });
  }
  state = await setBotState(m.from, { day, replies: replies + (run.reply ? 1 : 0), ...(run.handoff ? {} : { reason: undefined, note: undefined }) });

  if (run.booked) await addNote(m.from, `📅 El asistente agendó una cita: ${run.booked}.`).catch(() => {});

  if (run.order) {
    await addNote(m.from, `🛒 El asistente tomó el pedido ${run.order} (confirmado en el chat).`).catch(() => {});
    if ((await getTags()).some((t) => t.id === 'confirmado')) {
      const current = (await getConversationTags())[m.from] || [];
      if (!current.includes('confirmado')) await setConversationTags(m.from, [...current, 'confirmado']).catch(() => {});
    }
  }

  if (run.handoff) {
    await setBotState(m.from, { paused: true, pausedAt: new Date().toISOString(), reason: 'handoff', note: run.handoff.motivo });
    await addNote(m.from, `🤖 El asistente pasó el chat a una persona: ${run.handoff.motivo}`).catch(() => {});
    const tag = HANDOFF_TAG[run.handoff.tipo];
    if (tag && (await getTags()).some((t) => t.id === tag)) {
      const current = (await getConversationTags())[m.from] || [];
      if (!current.includes(tag)) await setConversationTags(m.from, [...current, tag]).catch(() => {});
    }
  }
}
