// "Seguimiento": one message to customers who stopped answering without ordering.
// Sent inside WhatsApp's free 24 h window (no paid template), written by Claude from the chat.
import { db, listOrders } from '@/lib/server/db';
import { getAutoSettings, getConversationAds, addNote } from '@/lib/server/crm-store';
import { botConfigured, chatHistory, getBotSettings, getBotStates, writeFollowUp } from '@/lib/server/bot';
import { sendText, whatsappEnabled } from '@/lib/server/whatsapp';
import { recordOutbound, samePhone } from '@/lib/server/wa-store';
import { localTime } from '@/lib/crm';
import type { AdRef } from '@/lib/ads';
import { appointmentsForPhone, isAppointmentsBusiness } from '@/lib/server/agenda';

const WINDOW_MS = 23 * 3600000; // stay safely inside the 24 h window
const AGAIN_AFTER_MS = 7 * 86400000; // at most one follow-up per chat per week
const PER_RUN = 6; // Claude calls per store per scheduled run

export interface FollowUpMark {
  at: string;
  sent: boolean; // false = Claude judged it better not to write, or sending failed
  error?: string;
}

async function readMarks(): Promise<Record<string, FollowUpMark>> {
  const { data } = await (await db()).from('settings').select('data').eq('id', 'wa_followups').maybeSingle();
  return (data?.data as Record<string, FollowUpMark>) || {};
}
async function writeMarks(all: Record<string, FollowUpMark>) {
  // Keep the newest 3.000.
  const keys = Object.keys(all);
  if (keys.length > 3000) keys.sort((a, b) => (all[a].at < all[b].at ? -1 : 1)).slice(0, keys.length - 3000).forEach((k) => delete all[k]);
  await (await db()).from('settings').upsert({ id: 'wa_followups', data: all });
}

// Daytime only (8 a. m. – 8 p. m. in the store's time zone): the run later in the window sends it.
function daytime(timeZone: string, now = new Date()) {
  const { hhmm } = localTime(now, timeZone);
  return hhmm >= '08:00' && hhmm < '20:00';
}

export async function processFollowUps(now = new Date(), deadline = Date.now() + 40000): Promise<{ sent: number; skipped: number; error?: string }> {
  const out = { sent: 0, skipped: 0 };
  const settings = await getBotSettings();
  const f = settings.followUp;
  if (!f.enabled || !(await botConfigured()) || !(await whatsappEnabled())) return out;
  const auto = await getAutoSettings();
  if (!daytime(auto.timezone, now)) return out;

  const from = new Date(now.getTime() - WINDOW_MS).toISOString();
  const to = new Date(now.getTime() - f.afterHours * 3600000).toISOString();
  const { data, error } = await (await db())
    .from('wa_conversations')
    .select('id, name, last_message_at, last_inbound_at, order_id')
    .gte('last_inbound_at', from)
    .lte('last_inbound_at', to)
    .order('last_inbound_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  // We answered last (a question still waiting for us is for a person, not a follow-up), and no order linked.
  let candidates = (data || []).filter((c: any) => !c.order_id && c.last_message_at && c.last_inbound_at && c.last_message_at > c.last_inbound_at);
  if (!candidates.length) return out;

  const [marks, states, ads] = await Promise.all([readMarks(), getBotStates(), getConversationAds().catch(() => ({}) as Record<string, AdRef>)]);
  candidates = candidates.filter((c: any) => {
    const m = marks[c.id];
    if (m && now.getTime() - new Date(m.at).getTime() < AGAIN_AFTER_MS) return false;
    if (states[c.id]?.paused) return false; // a person is handling it
    if (f.onlyAds && !ads[c.id]) return false;
    return true;
  });
  if (!candidates.length) return out;

  // Already bought (with another chat or from a landing) in the last 30 days.
  const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
  const orders = (await listOrders(1000)).filter((o) => o.createdAt >= monthAgo);
  const appointmentsBiz = await isAppointmentsBusiness();

  for (const c of candidates.slice(0, PER_RUN) as any[]) {
    if (Date.now() > deadline) break; // many stores: the next run (5 min) continues
    if (orders.some((o) => samePhone(o as any, c.id))) {
      marks[c.id] = { at: now.toISOString(), sent: false, error: 'ya tiene pedido' };
      out.skipped++;
      continue;
    }
    if (appointmentsBiz && (await appointmentsForPhone(c.id).catch(() => [])).some((x) => x.status === 'pending' || x.status === 'confirmed')) {
      marks[c.id] = { at: now.toISOString(), sent: false, error: 'ya tiene cita' };
      out.skipped++;
      continue;
    }
    // Claim it first, so an overlapping run never writes twice.
    marks[c.id] = { at: now.toISOString(), sent: false };
    await writeMarks(marks);
    try {
      const text = await writeFollowUp({ settings, phone: c.id, customerName: c.name, ad: ads[c.id] || null, history: await chatHistory(c.id), hours: f.afterHours });
      if (!text) {
        out.skipped++;
        continue;
      }
      const result = await sendText(c.id, text);
      await recordOutbound({ phone: c.id, type: 'followup', body: text, result });
      marks[c.id] = { at: now.toISOString(), sent: result.ok, ...(result.ok ? {} : { error: result.error || 'no se pudo enviar' }) };
      if (result.ok) {
        out.sent++;
        await addNote(c.id, `⏰ Seguimiento automático: el cliente no respondía hace ${f.afterHours} h.`).catch(() => {});
      }
    } catch (e: any) {
      marks[c.id] = { at: now.toISOString(), sent: false, error: String(e?.message || e).slice(0, 200) };
    }
  }
  await writeMarks(marks);
  return out;
}

// For the panel: follow-ups sent in the last 30 days and how many of those customers ordered afterwards.
export async function followUpStats(now = new Date()): Promise<{ sent: number; recovered: number; revenue: number }> {
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();
  const sent = Object.entries(await readMarks()).filter(([, m]) => m.sent && m.at >= since);
  if (!sent.length) return { sent: 0, recovered: 0, revenue: 0 };
  const orders = (await listOrders(1000)).filter((o) => o.createdAt >= since && o.status !== 'cancelled');
  let recovered = 0;
  let revenue = 0;
  for (const [phone, m] of sent) {
    const o = orders.find((x) => x.createdAt >= m.at && samePhone(x as any, phone));
    if (o) {
      recovered++;
      revenue += Number(o.totalAmount) || 0;
    }
  }
  return { sent: sent.length, recovered, revenue };
}
