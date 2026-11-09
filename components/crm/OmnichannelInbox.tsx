'use client';

// Mensajes: one inbox for one or several stores (WhatsApp, Messenger, Instagram), via /api/whatsapp/*. Polls every 10 s.
// Chats that need a person come first; the four cards on top (Necesitan tu ayuda, Retoma, IA trabajando, Atendiendo) filter the list.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  FileText,
  Filter as FilterIcon,
  Hand,
  Loader2,
  Megaphone,
  MessageSquare,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  User,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import NewOrderModal from '@/components/orders/NewOrderModal';
import ChatAttach from '@/components/crm/ChatAttach';
import ProductPhotos from '@/components/crm/ProductPhotos';
import { isCloud } from '@/lib/cloud';
import type { OrderSummary, WaConversation, WaMessage } from '@/lib/server/wa-store';
import { fillQuickReply, type Agent, type CrmTag, type QuickReply } from '@/lib/crm';
import { AssignPicker, QuickReplyManager, QuickReplyMenu, TagChip, TagManager, TagPicker, crmApi, matchReplies } from '@/components/crm/CrmParts';
import TeamManager from '@/components/crm/TeamManager';
import StorePicker, { useInboxStores } from '@/components/crm/StorePicker';
import { CHANNEL_LABEL, CHAT_ID_RE, chatChannel, isSocialChat, type ChatChannel } from '@/lib/social';
import { notifyPermission, requestNotify } from '@/lib/notify';
import { type OrderAction } from '@/components/crm/OrderPanel';
import { CustomerPanel, type PanelTab } from '@/components/crm/CustomerPanel';
import { SOUND_EVENT, UNREAD_REFRESH_EVENT, playMessageSound, setSoundOn, soundOn } from '@/lib/notify';
import { chatOrgHeaders, setChatOrg, storeColor, withChatOrg } from '@/lib/inbox-stores';
import { ago, RETAKE_AFTER_MS } from '@/lib/home';
import { todayCo } from '@/components/ads/DateRangePicker';

type BotState = { paused: boolean; reason: string | null; note: string | null; at?: string | null } | null;
type Conversation = WaConversation & {
  order: OrderSummary | null;
  tags?: string[];
  assignee?: string | null;
  bot?: BotState;
  followUpAt?: string | null; // the AI's automatic follow-up really went out
  ad?: { id: string; headline: string | null; body: string | null; url: string | null; thumb: string | null; at: string } | null;
  org: string; // store ('' = the session's store when the store list isn't available)
  key: string; // org|id: the same customer can write to two stores
};
interface BotInfo {
  enabled: boolean;
  mode: 'always' | 'away';
  name: string;
}
interface WaStatus {
  sending: boolean;
  confirmTemplate: boolean;
  webhook: boolean;
  missing: string[];
}
interface StoreData {
  id: string;
  name: string;
  tags: CrmTag[];
  agents: Agent[];
  bot: BotInfo | null;
  wa: WaStatus | null;
  me: { agentId: string | null; restricted: boolean; role: string | null } | null;
  social: { messenger: boolean; instagram: boolean };
  error?: string;
}

type Focus = 'all' | 'help' | 'retake' | 'ai' | 'attending';
type Adv = '' | 'unread' | 'unanswered' | 'pending' | 'confirmed' | 'mine' | 'unassigned';
type Period = 'hour' | 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom';

const ME_KEY = 'lp_agent'; // who is using this browser (for "Míos"), when the account isn't linked to a team person
const PENDING_ORDER = ['pending_call', 'retry_scheduled', 'needs_review', 'unanswered', 'calling'];
const POLL_MS = 10_000;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const PERIODS: { id: Period; label: string }[] = [
  { id: 'hour', label: 'Última hora' },
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'all', label: 'Todo' },
];
const ADV: { id: Adv; label: string }[] = [
  { id: '', label: 'Todos' },
  { id: 'unread', label: 'Sin leer' },
  { id: 'unanswered', label: 'Sin responder' },
  { id: 'pending', label: 'Pedido pendiente' },
  { id: 'confirmed', label: 'Pedido confirmado' },
  { id: 'mine', label: 'Míos' },
  { id: 'unassigned', label: 'Sin asignar' },
];

const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : NaN);
// The customer wrote last and nobody has answered yet.
const isUnanswered = (c: Conversation) => Boolean(c.last_inbound_at && (!c.last_message_at || c.last_inbound_at >= c.last_message_at));
// The AI handed it to a person (or hit its daily limit) and nobody has taken it.
const needsHelp = (c: Conversation) => Boolean(c.bot?.paused && (c.bot.reason === 'handoff' || c.bot.reason === 'limit'));
// The AI answered last, the customer has been quiet 2 h, no order, and there's still time inside the 24 h window.
const isRetake = (c: Conversation, now: number) => {
  if (c.order || c.bot?.paused || !c.last_inbound_at || !c.last_message_at || c.last_message_at <= c.last_inbound_at) return false;
  const quiet = now - ms(c.last_inbound_at);
  return quiet >= RETAKE_AFTER_MS && quiet < WINDOW_MS;
};
const aiWorking = (c: Conversation, now: number, botOn: boolean) => botOn && !c.bot?.paused && Boolean(c.last_inbound_at) && now - ms(c.last_inbound_at) < WINDOW_MS && !isRetake(c, now);
// Last message in the chat, from either side (what WhatsApp sorts by).
const lastActivity = (c: Conversation) => [c.last_message_at, c.last_inbound_at].filter(Boolean).sort().pop() || '';
const ORDER_KEY = 'konnexa_inbox_order';
const isAttending = (c: Conversation) => Boolean(c.bot?.paused && c.bot.reason === 'human');
const keyOf = (org: string, id: string) => `${org}|${id}`;
const splitKey = (k: string) => {
  const i = k.indexOf('|');
  return { org: k.slice(0, i), id: k.slice(i + 1) };
};

const ymdCo = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const daysAgo = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - n * 86400000));
function inPeriod(c: Conversation, p: Period, since: string, until: string, now: number) {
  if (p === 'all') return true;
  const at = c.last_message_at || c.created_at;
  if (!at) return false;
  if (p === 'hour') return now - ms(at) <= 3600_000;
  const d = ymdCo(at);
  if (p === 'today') return d === todayCo();
  if (p === 'yesterday') return d === daysAgo(1);
  if (p === '7d') return d >= daysAgo(6);
  if (p === '30d') return d >= daysAgo(29);
  return (!since || d >= since) && (!until || d <= until);
}

function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c4.55 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.28-2.42 5.84a8.17 8.17 0 01-5.83 2.41c-1.47 0-2.92-.39-4.18-1.14l-.3-.18-3.11.82.83-3.03-.2-.31a8.192 8.192 0 01-1.26-4.41c0-4.54 3.7-8.24 8.23-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8 2.53 1.09 2.53.73 2.99.69.45-.04 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
    </svg>
  );
}

// Small mark of where the chat comes from (on the avatar and in the header).
function ChannelMark({ id, className = '' }: { id: string; className?: string }) {
  const ch = chatChannel(id);
  if (ch === 'messenger')
    return (
      <span title="Messenger" className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[#00B2FF] to-[#006AFF] text-white ${className}`}>
        <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="currentColor" aria-hidden>
          <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.15.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.98-.87c.17-.08.36-.09.53-.04.91.25 1.88.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm6 7.46l-2.94 4.66c-.47.74-1.47.93-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66c.47-.74 1.47-.93 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63z" />
        </svg>
      </span>
    );
  if (ch === 'instagram')
    return (
      <span title="Instagram" className={`inline-flex items-center justify-center rounded-full bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5] text-white ${className}`}>
        <svg viewBox="0 0 24 24" className="w-[65%] h-[65%]" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
        </svg>
      </span>
    );
  return (
    <span title="WhatsApp" className={`inline-flex items-center justify-center rounded-full bg-[#25D366] text-white ${className}`}>
      <WhatsAppIcon className="w-[65%] h-[65%]" />
    </span>
  );
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending_call: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700 ring-amber-600/15' },
  retry_scheduled: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700 ring-amber-600/15' },
  needs_review: { label: 'Revisar', cls: 'bg-blue-50 text-blue-700 ring-blue-600/15' },
  unanswered: { label: 'No contesta', cls: 'bg-orange-50 text-orange-700 ring-orange-600/15' },
  calling: { label: 'Llamando', cls: 'bg-violet-50 text-violet-700 ring-violet-600/15' },
  confirmed_by_voice: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' },
  cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-600 ring-slate-500/15' },
  shipped: { label: 'En camino', cls: 'bg-sky-50 text-sky-700 ring-sky-600/15' },
  delivered: { label: 'Entregado', cls: 'bg-green-50 text-green-700 ring-green-600/15' },
};

const money = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;
// "[image] hola" → "📷 Foto: hola" in the chat list.
const MEDIA_LABEL: Record<string, string> = { image: '📷 Foto', audio: '🎤 Nota de voz', video: '🎬 Video', document: '📄 Documento', sticker: '🙂 Sticker' };
const preview = (t: string | null) => {
  const m = /^\[(image|audio|video|document|sticker)\]\s*(.*)$/.exec(t || '');
  return m ? `${MEDIA_LABEL[m[1]]}${m[2] ? `: ${m[2]}` : ''}` : t || '';
};
const phoneLabel = (p: string) => (isSocialChat(p) ? CHANNEL_LABEL[chatChannel(p)] : `+${p}`);

function timeLabel(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { code: data.code });
  return data;
}

// A tag that says the same as the order chip next to it (e.g. "Confirmado") is not shown twice.
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const sameAsOrder = (tagName: string | undefined, orderStatus: string | undefined) =>
  Boolean(tagName && orderStatus && ORDER_STATUS[orderStatus] && norm(ORDER_STATUS[orderStatus].label) === norm(tagName));

function OrderChip({ status }: { status: string }) {
  const s = ORDER_STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-600 ring-slate-500/15' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}

function StoreChip({ name, id }: { name: string; id: string }) {
  return <span className={`inline-flex items-center max-w-[160px] px-2 py-0.5 rounded-md text-[11px] font-medium ${storeColor(id)}`}><span className="truncate">{name}</span></span>;
}

function AdChip({ ad, full }: { ad: NonNullable<Conversation['ad']>; full?: boolean }) {
  const label = ad.headline || `Anuncio ${ad.id}`;
  return (
    <span className="inline-flex items-center gap-1 max-w-full text-[11px] font-medium text-sky-800 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5" title={`Llegó desde el anuncio: ${label} (id ${ad.id})`}>
      <Megaphone className="w-3 h-3 shrink-0" />
      <span className="truncate">{full ? label : 'Anuncio'}</span>
    </span>
  );
}

function Ticks({ m }: { m: WaMessage }) {
  if (m.direction !== 'out') return null;
  if (m.status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
  if (m.status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-sky-500" />;
  if (m.status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
  if (m.status === 'sent') return <Check className="w-3.5 h-3.5 text-slate-400" />;
  return <Clock className="w-3.5 h-3.5 text-slate-300" />;
}

// Photo, voice note, video, document or sticker (streamed through /api/whatsapp/media, from the chat's store).
function MediaView({ m }: { m: WaMessage }) {
  const [failed, setFailed] = useState(false);
  const media = m.media!;
  const src = media.url || withChatOrg(`/api/whatsapp/media/${media.id}`);
  if (failed) return <p className="text-xs text-slate-500 italic">El archivo ya no está disponible en WhatsApp (se guarda unos 30 días).</p>;
  if (media.kind === 'image' || media.kind === 'sticker')
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block">
        <img src={src} alt={media.caption || (m.direction === 'out' ? 'Foto enviada' : 'Foto del cliente')} onError={() => setFailed(true)} className={`rounded-xl ${media.kind === 'sticker' ? 'w-28 h-28 object-contain' : 'max-h-72 w-auto max-w-full object-cover'}`} />
      </a>
    );
  if (media.kind === 'audio') {
    // iPhone (and old Safari) can't play WhatsApp's OGG/Opus: ask for an MP3 copy.
    const asMp3 = !media.url && typeof document !== 'undefined' && !document.createElement('audio').canPlayType('audio/ogg; codecs=opus');
    const audioSrc = asMp3 ? withChatOrg(`/api/whatsapp/media/${media.id}?as=mp3`) : src;
    return <audio controls preload="metadata" src={audioSrc} onError={() => setFailed(true)} className="w-64 max-w-full h-10" />;
  }
  if (media.kind === 'video') return <video controls preload="metadata" src={src} onError={() => setFailed(true)} className="rounded-xl max-h-72 max-w-full" />;
  const name = media.filename || 'documento';
  return (
    <a href={media.url ? src : withChatOrg(`/api/whatsapp/media/${media.id}?name=${encodeURIComponent(name)}`)} target={media.url ? '_blank' : undefined} rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 hover:bg-slate-100">
      <FileText className="w-5 h-5 text-slate-500 shrink-0" />
      <span className="text-[13px] text-slate-800 truncate">{name}</span>
      <span className="text-[11px] font-semibold text-slate-500 shrink-0">Descargar</span>
    </a>
  );
}

// WhatsApp's free 24-hour reply window, counted from the customer's last message.
function windowLeft(lastInboundAt: string | null | undefined, now: number) {
  return lastInboundAt ? WINDOW_MS - (now - new Date(lastInboundAt).getTime()) : -1;
}
function WindowChip({ left }: { left: number }) {
  const title = 'WhatsApp deja escribir gratis durante 24 horas después del último mensaje del cliente. Después solo se puede usar una plantilla aprobada.';
  if (left <= 0)
    return (
      <span title={title} className="inline-flex items-center gap-1.5 whitespace-nowrap h-8 px-3 rounded-full text-[12px] font-medium bg-slate-100 text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Ventana cerrada
      </span>
    );
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const urgent = left < 2 * 3600000;
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 whitespace-nowrap h-8 px-3 rounded-full text-[12px] font-medium ${urgent ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${urgent ? 'bg-amber-500' : 'bg-blue-600'}`} /> Ventana: {h ? `${h}h ${m}m` : `${m} min`}
    </span>
  );
}

// What the chat is, in one line (list and thread header).
function chatStatus(c: Conversation, now: number, botOn: boolean, assigneeName: string | null) {
  if (needsHelp(c)) return { label: 'Necesita tu ayuda', cls: 'text-amber-700', Icon: AlertTriangle };
  if (isRetake(c, now)) return c.followUpAt ? { label: 'Seguimiento enviado', cls: 'text-violet-700', Icon: Clock } : { label: 'Por retomar', cls: 'text-violet-700', Icon: Clock };
  if (isUnanswered(c) && (!botOn || c.bot?.paused)) return { label: 'Espera respuesta', cls: 'text-red-600', Icon: Clock };
  if (isAttending(c)) return { label: assigneeName ? `Atiende ${assigneeName}` : 'Atendiendo', cls: 'text-emerald-700', Icon: UserRound };
  if (aiWorking(c, now, botOn)) return { label: 'IA atendiendo', cls: 'text-violet-700', Icon: Bot };
  return null;
}

function reasonText(c: Conversation) {
  if (needsHelp(c)) return c.bot?.reason === 'limit' ? 'La IA llegó a su límite de respuestas del día con este cliente.' : c.bot?.note || 'La IA pidió una persona.';
  return preview(c.last_message);
}

// "Qué hacer" for the open chat.
function Guide({ c, now, botOn, botName, busy, onBot }: { c: Conversation; now: number; botOn: boolean; botName: string; busy: boolean; onBot: (pause: boolean) => void }) {
  const left = windowLeft(c.last_inbound_at, now);
  let tone = 'bg-slate-50 border-slate-200 text-slate-700';
  let title = 'Nada pendiente';
  let steps: string[] = ['Este chat no necesita nada por ahora.'];
  if (needsHelp(c)) {
    tone = 'bg-amber-50 border-amber-200 text-amber-900';
    title = 'Necesita tu ayuda';
    steps = [
      c.bot?.reason === 'limit' ? 'La IA llegó a su límite de respuestas del día con este cliente.' : `La IA pidió una persona: ${c.bot?.note || 'no supo seguir sola'}.`,
      isUnanswered(c) && c.last_inbound_at ? `El cliente lleva ${ago(c.last_inbound_at, now)} esperando. Respóndele tú.` : 'Revisa la conversación y responde tú.',
      botOn ? `Cuando quede resuelto, devuélvelo a ${botName}.` : '',
    ];
  } else if (isRetake(c, now)) {
    tone = 'bg-violet-50 border-violet-200 text-violet-900';
    title = c.followUpAt ? 'Seguimiento enviado, sin respuesta' : 'Por retomar';
    steps = c.followUpAt
      ? [`La IA le escribió un seguimiento hace ${ago(c.followUpAt, now)} y el cliente no ha respondido.`, 'Si quieres insistir, escríbele tú.']
      : [`La IA contestó hace ${ago(c.last_message_at, now)} y el cliente no volvió a escribir. Todavía nadie le ha hecho seguimiento.`, 'Escríbele para cerrar la venta: pregúntale si le quedó alguna duda.'];
  } else if (isUnanswered(c) && (!botOn || c.bot?.paused)) {
    tone = 'bg-red-50 border-red-200 text-red-900';
    title = 'El cliente espera respuesta';
    steps = [`Escribió hace ${ago(c.last_inbound_at, now)} y nadie le ha contestado.`];
  } else if (isAttending(c)) {
    tone = 'bg-emerald-50 border-emerald-200 text-emerald-900';
    title = 'Lo está atendiendo una persona';
    steps = [botOn ? `${botName} está en pausa en este chat. Si ya terminaste, devuélvelo a la IA.` : 'Sigue la conversación desde aquí.'];
  } else if (aiWorking(c, now, botOn)) {
    tone = 'bg-violet-50 border-violet-100 text-violet-900';
    title = `${botName} lo está atendiendo`;
    steps = ['No necesitas hacer nada. Si escribes tú, la IA se pausa en este chat.'];
  }
  return (
    <section className={`rounded-xl border p-3 ${tone}`}>
      <p className="text-[13px] font-semibold">{title}</p>
      <ul className="mt-1.5 space-y-1 text-[13px]">
        {steps.filter(Boolean).map((s) => (
          <li key={s}>• {s}</li>
        ))}
        {left > 0 && left < 2 * 3600000 && <li>• Quedan menos de 2 horas para responder gratis por WhatsApp.</li>}
      </ul>
      {botOn && (
        <button
          onClick={() => onBot(!c.bot?.paused)}
          disabled={busy}
          className={`mt-3 h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 ${c.bot?.paused ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-white border border-violet-200 text-violet-800 hover:bg-violet-50'}`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : c.bot?.paused ? <Sparkles className="w-3.5 h-3.5" /> : <Hand className="w-3.5 h-3.5" />}
          {c.bot?.paused ? `Devolver a ${botName}` : 'Tomar el control'}
        </button>
      )}
    </section>
  );
}

export default function OmnichannelInbox() {
  const { stores, chosen, sel } = useInboxStores();
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [storeData, setStoreData] = useState<Record<string, StoreData>>({});
  const [loaded, setLoaded] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  // /crm?c=<phone>&org=<store> opens that chat (links from Inicio, Agenda and Pedidos).
  const [wanted, setWanted] = useState<{ id: string; org: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(window.location.search);
    const c = (q.get('c') || '').trim();
    if (!c) return null;
    return { id: CHAT_ID_RE.test(c) ? c : c.replace(/\D/g, ''), org: q.get('org') || '' }; // "+57 300…" still works for phones
  });
  const [activeKey, setActiveKey] = useState('');
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [botBusy, setBotBusy] = useState(false);
  const [me, setMe] = useState('');
  const [others, setOthers] = useState<{ name: string; typing: boolean }[]>([]);
  const [alerts, setAlerts] = useState<NotificationPermission | 'unsupported'>('default');
  const typingAt = useRef(0);
  const [replies, setReplies] = useState<QuickReply[]>([]);
  // List order: newest activity first (like WhatsApp) or what needs a person first. Remembered per browser.
  const [order, setOrder] = useState<'recent' | 'priority'>('recent');
  useEffect(() => {
    try {
      if (localStorage.getItem(ORDER_KEY) === 'priority') setOrder('priority');
    } catch {}
  }, []);
  const pickOrder = (o: 'recent' | 'priority') => {
    setOrder(o);
    try {
      localStorage.setItem(ORDER_KEY, o);
    } catch {}
  };
  const [focus, setFocus] = useState<Focus>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('f') === 'handoff' ? 'help' : 'all'));
  const [adv, setAdv] = useState<Adv>(() => {
    if (typeof window === 'undefined') return '';
    const f = new URLSearchParams(window.location.search).get('f') || '';
    return (ADV.map((a) => a.id) as string[]).includes(f) ? (f as Adv) : '';
  });
  const [tagFilter, setTagFilter] = useState(''); // tag name (stores have their own tags)
  const [channel, setChannel] = useState<'' | ChatChannel>('');
  const [period, setPeriod] = useState<Period>('all');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [advOpen, setAdvOpen] = useState(false);
  const [manage, setManage] = useState<'tags' | 'replies' | 'team' | null>(null);
  // Quick reply menu: open with ⚡ (query typed in the box is ignored) or by typing "/atajo".
  const [qr, setQr] = useState<{ open: boolean; slash: boolean; highlight: number }>({ open: false, slash: false, highlight: 0 });
  const [orderOpen, setOrderOpen] = useState(false); // right panel on small screens
  const [panelTab, setPanelTab] = useState<PanelTab>('todo');
  const [newOrder, setNewOrder] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [sound, setSound] = useState(true);
  const [tplBusy, setTplBusy] = useState(false);
  const [tplMsg, setTplMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const advRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeKey);
  activeRef.current = activeKey;

  const currentId = stores?.find((s) => s.current)?.id || '';
  const multi = (stores?.length || 0) > 1;
  // Stores to load: the chosen ones; without the store list (no database, old session) the session's store.
  const targets = useMemo(() => (!stores ? null : stores.length ? (chosen || []).map((s) => ({ id: s.id, name: s.name })) : [{ id: '', name: '' }]), [stores, chosen]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const currentRef = useRef(currentId);
  currentRef.current = currentId;
  const hdr = (org: string) => chatOrgHeaders(org && org !== currentRef.current ? org : null);

  const active = conversations.find((c) => c.key === activeKey) || null;
  const activeOrg = activeKey ? splitKey(activeKey).org : '';
  // Requests made by the parts of the open chat (tags, order, attachments, team) go to its store.
  setChatOrg(activeOrg && activeOrg !== currentId ? activeOrg : null);
  useEffect(() => () => setChatOrg(null), []);
  const sd: StoreData | null = storeData[activeOrg] || null;
  const tags = sd?.tags || [];
  const agents = sd?.agents || [];
  const botInfo = sd?.bot || null;
  const wa = sd?.wa || null;

  useEffect(() => {
    isCloud().then(setCloud);
    setSound(soundOn());
    try {
      setMe(localStorage.getItem(ME_KEY) || '');
    } catch {}
    const sync = () => setSound(soundOn());
    window.addEventListener(SOUND_EVENT, sync);
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.removeEventListener(SOUND_EVENT, sync);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!advOpen) return;
    const out = (e: MouseEvent) => advRef.current && !advRef.current.contains(e.target as Node) && setAdvOpen(false);
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [advOpen]);

  const loadConversations = useCallback(async () => {
    const list = targetsRef.current;
    if (!list) return;
    if (!list.length) {
      setConversations([]);
      setStoreData({});
      setLoaded(true);
      return;
    }
    type R = { conversations: Omit<Conversation, 'org' | 'key'>[]; tags: CrmTag[]; agents: Agent[]; bot?: BotInfo; whatsapp: WaStatus; me?: StoreData['me']; social?: StoreData['social'] };
    const results = await Promise.allSettled(list.map((s) => api<R>('/api/whatsapp/conversations', { headers: hdr(s.id) })));
    if (targetsRef.current !== list) return; // the chosen stores changed meanwhile
    const data: Record<string, StoreData> = {};
    const all: Conversation[] = [];
    let fails = 0;
    let lastError = '';
    results.forEach((r, i) => {
      const s = list[i];
      if (r.status === 'rejected') {
        fails++;
        lastError = r.reason?.message || 'Error';
        data[s.id] = { id: s.id, name: s.name, tags: [], agents: [], bot: null, wa: null, me: null, social: { messenger: false, instagram: false }, error: lastError };
        return;
      }
      const d = r.value;
      data[s.id] = { id: s.id, name: s.name, tags: d.tags || [], agents: d.agents || [], bot: d.bot || null, wa: d.whatsapp, me: d.me || null, social: d.social || { messenger: false, instagram: false } };
      for (const c of d.conversations) all.push({ ...(c as Conversation), org: s.id, key: keyOf(s.id, c.id) });
    });
    setStoreData(data);
    setConversations(all);
    setListError(fails === list.length ? lastError : null);
    setLoaded(true);
    setUpdatedAt(new Date());
    setNow(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMessages = useCallback(async (key: string) => {
    const { org, id } = splitKey(key);
    try {
      const d = await api<{ messages: WaMessage[]; conversation: Conversation; others?: { name: string; typing: boolean }[] }>(`/api/whatsapp/conversations/${id}/messages`, { headers: hdr(org) });
      if (activeRef.current !== key) return;
      setOthers(d.others || []);
      // Only replace when something changed, so polling doesn't re-scroll the thread.
      const sig = (xs: WaMessage[]) => xs.map((m) => `${m.id}:${m.status}`).join('|');
      setMessages((prev) => (sig(prev) === sig(d.messages) ? prev : d.messages));
      setConversations((prev) => prev.map((c) => (c.key === key ? { ...c, ...d.conversation, org: c.org, key: c.key, tags: c.tags, assignee: c.assignee, bot: c.bot, ad: c.ad, unread_count: c.unread_count } : c)));
      if (d.conversation.unread_count > 0) {
        await api(`/api/whatsapp/conversations/${id}/read`, { method: 'POST', headers: hdr(org) });
        setConversations((prev) => prev.map((c) => (c.key === key ? { ...c, unread_count: 0 } : c)));
        window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT));
      }
    } catch {
      // Keep what is on screen; the next poll retries.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "I have this chat open" every poll, so others see it (and don't answer at the same time).
  const sendPresence = useCallback((key: string, typing: boolean) => {
    const { org, id } = splitKey(key);
    fetch(`/api/whatsapp/conversations/${id}/presence`, { method: 'POST', headers: { 'content-type': 'application/json', ...hdr(org) }, body: JSON.stringify({ typing }) })
      .then((r) => r.json())
      .then((d) => d.success && activeRef.current === key && setOthers(d.others || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    (window as any).__lpActiveChat = activeKey ? splitKey(activeKey).id : ''; // the menu skips the notice for the chat on screen
    setOthers([]);
    if (!cloud || !activeKey) return;
    sendPresence(activeKey, false);
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && activeRef.current) sendPresence(activeRef.current, Date.now() - typingAt.current < 8000);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [cloud, activeKey, sendPresence]);

  // Load now when the chosen stores change, then poll while the tab is visible.
  useEffect(() => {
    if (!cloud || !targets) return;
    loadConversations();
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadConversations();
      if (activeRef.current) loadMessages(activeRef.current);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [cloud, targets, loadConversations, loadMessages]);

  // The open chat's store was removed from the view.
  useEffect(() => {
    if (activeKey && targets && !targets.some((t) => t.id === splitKey(activeKey).org)) setActiveKey('');
  }, [targets, activeKey]);

  // Open the chat from the link once the list is in.
  useEffect(() => {
    if (!wanted || !loaded) return;
    const hit =
      conversations.find((c) => c.id === wanted.id && (!wanted.org || c.org === wanted.org || (!c.org && wanted.org === currentId))) ||
      (!wanted.org ? conversations.find((c) => c.id === wanted.id && (c.org === currentId || !c.org)) || conversations.find((c) => c.id === wanted.id) : null);
    setActiveKey(hit ? hit.key : keyOf(wanted.org && wanted.org !== currentId ? wanted.org : currentId, wanted.id));
    setWanted(null);
  }, [wanted, loaded, conversations, currentId]);

  // Quick replies of the open chat's store.
  useEffect(() => {
    if (!cloud) return;
    crmApi<{ items: QuickReply[] }>('/api/whatsapp/quick-replies', { headers: hdr(activeOrg) })
      .then((d) => setReplies(d.items))
      .catch(() => setReplies([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, activeOrg]);

  useEffect(() => {
    setMessages([]);
    setSendError(null);
    setText('');
    setQr({ open: false, slash: false, highlight: 0 });
    setOrderOpen(false);
    setTplMsg(null);
    if (!activeKey) return;
    setThreadLoading(true);
    loadMessages(activeKey).finally(() => setThreadLoading(false));
  }, [activeKey, loadMessages]);

  // Scroll only the thread (scrollIntoView also moves the page, which hid the top on phones).
  useEffect(() => {
    const box = threadRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Grow the reply box with its text (up to ~6 lines).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const left = windowLeft(active?.last_inbound_at, now);
  const canReply = left > 0;
  const botOn = (c: Conversation) => Boolean(storeData[c.org]?.bot?.enabled);
  const storeName = (org: string) => storeData[org]?.name || stores?.find((s) => s.id === org)?.name || '';
  const myAgentId = (org: string) => storeData[org]?.me?.agentId || (org === currentId || !org ? me : '');
  const agentName = (c: Conversation) => (c.assignee && storeData[c.org]?.agents.find((a) => a.id === c.assignee)?.name) || null;
  const tagsOf = (c: Conversation) => {
    const byId = Object.fromEntries((storeData[c.org]?.tags || []).map((t) => [t.id, t]));
    return (c.tags || []).map((id) => byId[id]).filter(Boolean) as CrmTag[];
  };

  const sendTemplate = async () => {
    if (!active?.order) return;
    setTplBusy(true);
    setTplMsg(null);
    try {
      await crmApi('/api/whatsapp/confirm', { method: 'POST', body: JSON.stringify({ orderId: active.order.id }) });
      setTplMsg({ ok: true, text: 'Plantilla enviada. Cuando el cliente responda, se abre de nuevo la ventana de 24 horas.' });
      loadMessages(active.key);
      loadConversations();
    } catch (e: any) {
      setTplMsg({ ok: false, text: e.message });
    } finally {
      setTplBusy(false);
    }
  };

  // ---------- filters ----------

  const socialOn = Object.values(storeData).some((s) => s.social.messenger || s.social.instagram) || conversations.some((c) => isSocialChat(c.id));
  const allTagNames = useMemo(() => Array.from(new Set(Object.values(storeData).flatMap((s) => s.tags.map((t) => t.name)))).sort((a, b) => a.localeCompare(b)), [storeData]);

  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (channel && chatChannel(c.id) !== channel) return false;
      // Chats waiting for a person always show, whatever the period.
      if (!needsHelp(c) && !inPeriod(c, period, since, until, now)) return false;
      if (adv === 'unread' && !(c.unread_count > 0)) return false;
      if (adv === 'unanswered' && !isUnanswered(c)) return false;
      if (adv === 'pending' && !(c.order && PENDING_ORDER.includes(c.order.status))) return false;
      if (adv === 'confirmed' && c.order?.status !== 'confirmed_by_voice') return false;
      if (adv === 'mine' && (!myAgentId(c.org) || c.assignee !== myAgentId(c.org))) return false;
      if (adv === 'unassigned' && c.assignee) return false;
      const tagNames = tagsOf(c).map((t) => t.name);
      if (tagFilter && !tagNames.includes(tagFilter)) return false;
      if (!q) return true;
      return [c.name, c.id, c.last_message, c.order?.orderNumber, c.order?.productName, c.order?.customerName, storeName(c.org), ...tagNames].some((v) => v?.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, storeData, search, channel, period, since, until, adv, tagFilter, now, me]);

  const counts = useMemo(
    () => ({
      help: base.filter(needsHelp).length,
      retake: base.filter((c) => isRetake(c, now)).length,
      ai: base.filter((c) => aiWorking(c, now, botOn(c))).length,
      attending: base.filter(isAttending).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, now, storeData],
  );

  const filtered = useMemo(() => {
    const list = base.filter((c) => {
      if (focus === 'help') return needsHelp(c);
      if (focus === 'retake') return isRetake(c, now);
      if (focus === 'ai') return aiWorking(c, now, botOn(c));
      if (focus === 'attending') return isAttending(c);
      return true;
    });
    if (order === 'recent') return list.sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
    // First what needs a person: handed over, then customers waiting, then chats to pick up, then the rest.
    const rank = (c: Conversation) => (needsHelp(c) ? 0 : isUnanswered(c) && (!botOn(c) || c.bot?.paused) ? 1 : isRetake(c, now) ? 2 : 3);
    const at = (c: Conversation) => (needsHelp(c) ? c.bot?.at || c.last_message_at || '' : c.last_message_at || '');
    return list.sort((a, b) => rank(a) - rank(b) || at(b).localeCompare(at(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, focus, now, storeData, order]);

  const advActive = Boolean(adv || tagFilter || channel);
  const meAgent = agents.find((a) => a.id === myAgentId(activeOrg)) || null;
  const ownAgent = storeData[currentId]?.me?.agentId ? storeData[currentId].agents.find((a) => a.id === storeData[currentId].me?.agentId) || null : null;
  const toggleAvailable = async () => {
    if (!ownAgent) return;
    try {
      const d = await api<{ agent: CrmTag & { available?: boolean } }>('/api/whatsapp/agents', { method: 'PATCH', body: JSON.stringify({ available: ownAgent.available === false }) });
      setStoreData((all) => ({ ...all, [currentId]: { ...all[currentId], agents: all[currentId].agents.map((a) => (a.id === d.agent.id ? { ...a, available: d.agent.available } : a)) } }));
    } catch {}
  };
  const enableAlerts = async () => setAlerts(await requestNotify());
  useEffect(() => setAlerts(notifyPermission()), []);
  const chooseMe = (id: string) => {
    setMe(id);
    try {
      if (id) localStorage.setItem(ME_KEY, id);
      else localStorage.removeItem(ME_KEY);
    } catch {}
  };
  const markAllRead = async () => {
    await Promise.all((targets || []).map((s) => fetch('/api/whatsapp/conversations/read-all', { method: 'POST', headers: hdr(s.id) }).catch(() => null)));
    await loadConversations();
    window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT));
  };

  // ---------- quick replies ----------

  const replyVars = (c: Conversation | null) => {
    const o = c?.order;
    return {
      nombre: ((o?.customerName || c?.name || '').trim().split(/\s+/)[0] || '').replace(/^./, (x) => x.toUpperCase()),
      pedido: o?.orderNumber || '',
      producto: o ? [o.productName, o.comboName].filter(Boolean).join(' - ') : '',
      total: o ? money(o.totalAmount) : '',
      ciudad: o?.city || '',
      direccion: o?.address || '',
      transportadora: o?.carrier || '',
      guia: o?.trackingNumber || '',
    };
  };
  const fillReply = (r: QuickReply) => fillQuickReply(r.body, replyVars(active));
  const slashQuery = qr.slash ? (/^\/(\S*)$/.exec(text)?.[1] ?? '') : '';
  const menuList = qr.open ? matchReplies(replies, slashQuery) : [];

  const pickReply = (r: QuickReply) => {
    const body = fillReply(r);
    // "/atajo" is replaced; with ⚡ the reply is added after what is already written.
    setText((cur) => (qr.slash || !cur.trim() ? body : `${cur.replace(/\s+$/, '')}\n${body}`));
    setQr({ open: false, slash: false, highlight: 0 });
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const onTextChange = (v: string) => {
    setText(v);
    // Tell the team I'm writing here (at most every 5 s).
    if (activeKey && v.trim() && Date.now() - typingAt.current > 5000) {
      typingAt.current = Date.now();
      sendPresence(activeKey, true);
    }
    if (/^\/\S*$/.test(v)) setQr({ open: true, slash: true, highlight: 0 });
    else if (qr.slash) setQr({ open: false, slash: false, highlight: 0 });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (qr.open && menuList.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = menuList.length;
        setQr((s) => ({ ...s, highlight: (s.highlight + (e.key === 'ArrowDown' ? 1 : n - 1)) % n }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickReply(menuList[Math.min(qr.highlight, menuList.length - 1)]);
        return;
      }
    }
    if (qr.open && e.key === 'Escape') {
      e.preventDefault();
      setQr({ open: false, slash: false, highlight: 0 });
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---------- chat actions ----------

  const patchActive = (patch: Partial<Conversation>) => {
    const key = activeKey;
    setConversations((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const setBotPaused = async (paused: boolean) => {
    if (!active) return;
    setBotBusy(true);
    try {
      await crmApi(`/api/whatsapp/conversations/${active.id}/bot`, { method: 'POST', body: JSON.stringify({ action: paused ? 'pause' : 'resume' }) });
      patchActive({ bot: paused ? { paused: true, reason: 'human', note: null } : null });
    } finally {
      setBotBusy(false);
    }
  };

  const assign = async (agentId: string | null) => {
    if (!active) return;
    const d = await crmApi<{ assignee: string | null }>(`/api/whatsapp/conversations/${active.id}/assign`, { method: 'PUT', body: JSON.stringify({ agentId }) });
    patchActive({ assignee: d.assignee });
  };

  const saveConvTags = async (ids: string[]) => {
    if (!active) return;
    const d = await crmApi<{ tags: string[] }>(`/api/whatsapp/conversations/${active.id}/tags`, { method: 'PUT', body: JSON.stringify({ tags: ids }) });
    patchActive({ tags: d.tags });
  };

  const onOrderChanged = async (action: OrderAction, extra?: { carrier?: string; trackingNumber?: string }) => {
    await loadConversations();
    // After shipping, leave the "despachado" message (with the tracking number if given) ready to review and send.
    if (action === 'shipped' && canReply && !text.trim()) {
      const vars = { ...replyVars(active), pedido: '', transportadora: extra?.carrier || '', guia: extra?.trackingNumber || '' };
      const withGuide = extra?.trackingNumber ? replies.find((x) => x.shortcut === 'guia') : null;
      const r = withGuide || replies.find((x) => x.shortcut === 'envio');
      if (r) setText(fillQuickReply(r.body, vars));
      else if (extra?.trackingNumber) setText(fillQuickReply('Hola {nombre} 🚚 Tu pedido ya va en camino con {transportadora}. Número de guía: {guia}.', vars));
    }
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await api(`/api/whatsapp/conversations/${active.id}/messages`, { method: 'POST', body: JSON.stringify({ text: body }), headers: hdr(active.org) });
      setText('');
      setQr({ open: false, slash: false, highlight: 0 });
      if (botInfo?.enabled) patchActive({ bot: { paused: true, reason: 'human', note: null } });
      await loadMessages(active.key);
      loadConversations();
    } catch (e: any) {
      setSendError(e.message);
      loadMessages(active.key);
    } finally {
      setSending(false);
    }
  };

  const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

  // ---------- empty states ----------

  if (cloud === null) {
    return (
      <div className={`${card} flex-1 flex items-center justify-center text-slate-400`}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!cloud) {
    return (
      <div className={`${card} flex-1 flex items-center justify-center p-8`}>
        <div className="max-w-md text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">La bandeja necesita la base de datos</h2>
          <p className="text-sm text-slate-500">
            Los mensajes de WhatsApp se guardan en Supabase. Configura <code className="text-xs bg-slate-100 px-1 rounded">SUPABASE_URL</code> y{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> y después conecta WhatsApp en Integraciones.
          </p>
        </div>
      </div>
    );
  }

  const cards: { id: Exclude<Focus, 'all'>; label: string; n: number; Icon: typeof Clock; tone: string; on: string }[] = [
    { id: 'help', label: 'Necesitan tu ayuda', n: counts.help, Icon: AlertTriangle, tone: 'bg-amber-50/80 text-amber-600', on: 'ring-amber-400' },
    { id: 'retake', label: 'Por retomar', n: counts.retake, Icon: Clock, tone: 'bg-violet-50/70 text-violet-600', on: 'ring-violet-400' },
    { id: 'ai', label: 'IA trabajando', n: counts.ai, Icon: Bot, tone: 'bg-sky-50/70 text-sky-600', on: 'ring-sky-400' },
    { id: 'attending', label: 'Atendiendo', n: counts.attending, Icon: UserRound, tone: 'bg-emerald-50/70 text-emerald-600', on: 'ring-emerald-400' },
  ];
  const storeErrors = Object.values(storeData).filter((s) => s.error);
  const activeStatus = active ? chatStatus(active, now, botOn(active), agentName(active)) : null;
  const notConnected = wa && !wa.sending && active && !isSocialChat(active.id);

  const panel = active && (
    <CustomerPanel
      conversationId={active.id}
      order={active.order}
      orderChip={(st) => <OrderChip status={st} />}
      onOrderChanged={onOrderChanged}
      onCreateOrder={() => setNewOrder(true)}
      tab={panelTab}
      onTab={setPanelTab}
      guide={<Guide c={active} now={now} botOn={Boolean(botInfo?.enabled)} botName={botInfo?.name || 'La IA'} busy={botBusy} onBot={setBotPaused} />}
    />
  );

  return (
    <div className={`${card} flex-1 flex flex-col min-h-0 overflow-hidden text-slate-800`}>
      {/* Top bar: stores, search, filters, period and the four attention cards */}
      <div className={`${activeKey ? 'hidden md:block' : ''} shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 sm:px-4 pt-3 pb-3 space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          {stores && <StorePicker stores={stores} sel={sel} />}
          <div className="relative order-[9] basis-full sm:order-none sm:basis-auto flex-1 min-w-[180px] sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, teléfono o producto…"
              className="w-full h-10 text-[16px] sm:text-[13px] bg-white border border-slate-200 rounded-xl pl-9 pr-8 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Limpiar">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div ref={advRef} className="relative">
            <button
              onClick={() => setAdvOpen((o) => !o)}
              className={`h-10 px-3 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 ${advActive ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
            >
              <FilterIcon className="w-4 h-4" /> Filtros avanzados <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {advOpen && (
              <div className="absolute z-40 mt-2 left-0 w-[min(calc(100vw-2rem),340px)] bg-white rounded-2xl border border-slate-200 shadow-xl p-3 space-y-3 text-[13px]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Mostrar</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ADV.filter((a) => a.id !== 'mine' && a.id !== 'unassigned' ? true : Object.values(storeData).some((s) => s.agents.length)).map((a) => (
                      <button key={a.id || 'all'} onClick={() => setAdv(a.id)} className={`h-7 px-2.5 rounded-full text-[12px] font-medium ${adv === a.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                {socialOn && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Canal</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([['', 'Todos'], ['whatsapp', 'WhatsApp'], ['messenger', 'Messenger'], ['instagram', 'Instagram']] as ['' | ChatChannel, string][]).map(([k, label]) => (
                        <button key={k || 'all'} onClick={() => setChannel(k)} className={`h-7 px-2.5 rounded-full text-[12px] font-medium ${channel === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {allTagNames.length > 0 && (
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Etiqueta</span>
                    <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="mt-1.5 w-full h-9 border border-slate-200 rounded-lg px-2 bg-white text-slate-700">
                      <option value="">Todas las etiquetas</option>
                      {allTagNames.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {advActive && (
                  <button onClick={() => (setAdv(''), setTagFilter(''), setChannel(''))} className="text-[12px] font-semibold text-brand-blue">
                    Quitar filtros
                  </button>
                )}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <button onClick={markAllRead} className="w-full text-left text-slate-700 hover:text-slate-900 inline-flex items-center gap-2">
                    <CheckCheck className="w-4 h-4 text-slate-400" /> Marcar todo como leído
                  </button>
                  <button onClick={() => (setSoundOn(!sound), !sound && playMessageSound())} className="w-full text-left text-slate-700 hover:text-slate-900 inline-flex items-center gap-2">
                    {sound ? <Bell className="w-4 h-4 text-slate-400" /> : <BellOff className="w-4 h-4 text-slate-400" />} Sonido de mensaje nuevo: {sound ? 'activado' : 'apagado'}
                  </button>
                  {alerts !== 'unsupported' && alerts !== 'granted' && (
                    <button onClick={enableAlerts} className="w-full text-left text-slate-700 hover:text-slate-900 inline-flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-400" /> Activar avisos del navegador
                    </button>
                  )}
                  {ownAgent && (
                    <button onClick={toggleAvailable} className="w-full text-left text-slate-700 hover:text-slate-900 inline-flex items-center gap-2" title="Si estás ausente no te llegan chats nuevos del reparto automático">
                      <span className={`w-2.5 h-2.5 rounded-full ml-0.5 mr-0.5 ${ownAgent.available !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {ownAgent.available !== false ? 'Disponible para chats nuevos' : 'Ausente (no recibes chats nuevos)'}
                    </button>
                  )}
                  {!multi && !storeData[currentId]?.me?.agentId && agents.length > 0 && (
                    <select value={me} onChange={(e) => chooseMe(e.target.value)} className="w-full h-9 border border-slate-200 rounded-lg px-2 bg-white text-slate-700" aria-label="¿Quién eres?">
                      <option value="">¿Quién eres? (para “Míos”)</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          Soy {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-[11px] text-slate-400 mb-1.5">{multi ? `Ajustes de ${storeName(activeOrg || currentId) || 'esta tienda'}` : 'Ajustes'}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-medium text-slate-600">
                    <button onClick={() => (setManage('tags'), setAdvOpen(false))} className="hover:text-slate-900">Etiquetas</button>
                    <button onClick={() => (setManage('replies'), setAdvOpen(false))} className="hover:text-slate-900">Respuestas rápidas</button>
                    <button onClick={() => (setManage('team'), setAdvOpen(false))} className="hover:text-slate-900">Equipo</button>
                    <Link href="/automations" className="hover:text-slate-900">Respuestas automáticas</Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="order-[10] sm:order-none w-full sm:w-auto flex items-center gap-1 overflow-x-auto max-w-full">
            <span className="hidden lg:inline text-[11px] font-semibold uppercase tracking-wide text-slate-400 mr-1">Periodo</span>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`h-9 px-3 rounded-full text-[13px] font-medium whitespace-nowrap ${period === p.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="hidden 2xl:flex items-center gap-1.5 text-[13px] text-slate-400">
            <input type="date" value={since} max={until || todayCo()} onChange={(e) => (setSince(e.target.value), setPeriod('custom'))} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-slate-700" aria-label="Desde" />
            a
            <input type="date" value={until} min={since} max={todayCo()} onChange={(e) => (setUntil(e.target.value), setPeriod('custom'))} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-slate-700" aria-label="Hasta" />
          </div>
          {updatedAt && <span className="ml-auto hidden xl:inline text-[12px] text-slate-400">Actualizado {updatedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>

        <div className="grid grid-flow-col auto-cols-[minmax(170px,1fr)] lg:grid-flow-row lg:grid-cols-4 gap-2 sm:gap-3 overflow-x-auto">
          {cards.map((k) => (
            <button
              key={k.id}
              onClick={() => setFocus(focus === k.id ? 'all' : k.id)}
              aria-pressed={focus === k.id}
              className={`h-14 px-3 rounded-2xl flex items-center gap-3 text-left transition ${k.tone} ${focus === k.id ? `ring-2 ${k.on} bg-white` : 'hover:brightness-[0.98]'}`}
            >
              <span className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0">
                <k.Icon className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 min-w-0 text-[13px] sm:text-[14px] font-semibold text-slate-900 leading-tight">{k.label}</span>
              <span className="text-[22px] sm:text-[24px] font-bold text-slate-900 tabular-nums">{k.n}</span>
            </button>
          ))}
        </div>
      </div>

      {storeErrors.length > 0 && !listError && (
        <div className="hidden md:block px-4 py-2 border-b border-amber-200 bg-amber-50 text-[12px] text-amber-800">
          No se cargaron los chats de {storeErrors.map((s) => s.name || 'una tienda').join(', ')}: {storeErrors[0].error}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Conversation list */}
        <div className={`${activeKey ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] shrink-0 border-r border-slate-200 flex-col min-h-0`}>
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-slate-900">Conversaciones</h2>
              <span className="text-[13px] text-slate-400">{filtered.length}</span>
            </div>
            <div className="mt-2 inline-flex rounded-lg bg-slate-100 p-0.5 text-[12px] font-semibold" role="group" aria-label="Orden de la lista">
              {(
                [
                  ['recent', 'Más recientes'],
                  ['priority', 'Prioridad'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => pickOrder(id)} aria-pressed={order === id} className={`h-8 px-3 rounded-md ${order === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-slate-500">
              {focus === 'all' ? (order === 'recent' ? 'Arriba quien escribió más reciente.' : 'Primero lo que necesita a una persona.') : cards.find((k) => k.id === focus)?.label}
              {focus !== 'all' && (
                <button onClick={() => setFocus('all')} className="ml-2 font-semibold text-brand-blue">
                  Ver todas
                </button>
              )}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!loaded && (
              <div className="flex justify-center py-8 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
            {listError && <p className="m-3 text-xs text-red-600 bg-red-50 rounded-xl p-3">No se pudieron cargar las conversaciones: {listError}</p>}
            {loaded && targets && !targets.length && <p className="p-6 text-center text-[13px] text-slate-500">Elige al menos una tienda en “Bandejas que ves”.</p>}
            {loaded && !listError && !!targets?.length && filtered.length === 0 && (
              <div className="p-6 text-center text-[13px] text-slate-500">
                {conversations.length === 0
                  ? 'Aún no hay conversaciones. Aparecerán aquí cuando se envíe una confirmación de pedido o un cliente escriba a tu número de WhatsApp.'
                  : focus === 'help'
                    ? '¡Al día! Nadie está esperando a una persona.'
                    : focus === 'retake'
                      ? 'No hay chats para retomar.'
                      : 'Sin resultados con estos filtros.'}
              </div>
            )}
            {filtered.map((c) => {
              const st = chatStatus(c, now, botOn(c), agentName(c));
              const help = needsHelp(c);
              const tagList = tagsOf(c).filter((t) => !sameAsOrder(t.name, c.order?.status));
              return (
                <div
                  key={c.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKey(c.key)}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKey(c.key)}
                  className={`relative px-4 py-3.5 border-b border-slate-100 cursor-pointer transition border-l-[3px] ${help ? 'border-l-red-400' : 'border-l-transparent'} ${c.key === activeKey ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start gap-2">
                    {st ? <st.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${st.cls}`} /> : <ChannelMark id={c.id} className="w-4 h-4 mt-0.5 shrink-0" />}
                    <span className="flex-1 min-w-0 text-[15px] font-semibold text-slate-900 truncate">{c.name || phoneLabel(c.id)}</span>
                    <span className={`text-[12px] shrink-0 mt-0.5 ${c.unread_count > 0 ? 'text-[#1DA851] font-semibold' : 'text-slate-400'}`}>{lastActivity(c) ? `hace ${ago(order === 'priority' && help ? c.bot?.at || lastActivity(c) : lastActivity(c), now)}` : ''}</span>
                  </div>
                  {st && <p className={`mt-1 text-[11px] font-bold uppercase tracking-wide ${st.cls}`}>{st.label}</p>}
                  <div className="mt-0.5 flex items-end gap-2">
                    <p className="flex-1 min-w-0 text-[13px] text-slate-600 line-clamp-2">{reasonText(c)}</p>
                    {c.unread_count > 0 && <span className="text-[10px] font-bold bg-[#25D366] text-white rounded-full px-1.5 min-w-[18px] text-center shrink-0">{c.unread_count}</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    {multi && <StoreChip id={c.org} name={storeName(c.org)} />}
                    {isSocialChat(c.id) && <ChannelMark id={c.id} className="w-4 h-4" />}
                    {c.ad && <AdChip ad={c.ad} />}
                    {c.order && <OrderChip status={c.order.status} />}
                    {tagList.slice(0, 3).map((t) => (
                      <TagChip key={t.id} tag={t} small />
                    ))}
                    {help && (
                      <span className="ml-auto h-8 px-3 rounded-lg bg-brand-blue text-white text-[13px] font-semibold inline-flex items-center gap-1">
                        Atender <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thread */}
        <div className={`${activeKey ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 min-h-0`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-slate-400 p-6 text-center">{activeKey && !loaded ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Selecciona una conversación'}</div>
          ) : (
            <>
              <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-100 flex flex-wrap items-start gap-x-3 gap-y-2">
                <button onClick={() => setActiveKey('')} className="md:hidden p-1 -ml-1 mt-1 text-slate-500" aria-label="Volver">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-[220px] flex-1">
                  {activeStatus && (
                    <p className={`text-[11px] font-bold uppercase tracking-wide inline-flex items-center gap-1.5 ${activeStatus.cls}`}>
                      <activeStatus.Icon className="w-3.5 h-3.5" /> {activeStatus.label}
                    </p>
                  )}
                  <p className="text-[16px] sm:text-[17px] font-bold text-slate-900 truncate">{active.name || phoneLabel(active.id)}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {multi && <StoreChip id={active.org} name={storeName(active.org)} />}
                    <span className="text-[13px] text-slate-500 inline-flex items-center gap-1">
                      <ChannelMark id={active.id} className="w-3.5 h-3.5" /> {phoneLabel(active.id)}
                    </span>
                    {agentName(active) && <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 whitespace-nowrap">Con {agentName(active)}</span>}
                    {tagsOf(active)
                      .filter((t) => !sameAsOrder(t.name, active.order?.status))
                      .map((t) => (
                        <TagChip key={t.id} tag={t} small />
                      ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {active.ad && <AdChip ad={active.ad} full />}
                  <WindowChip left={left} />
                  <button onClick={() => setNewOrder(true)} title="Crear un pedido confirmado para este cliente" className="h-8 px-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 inline-flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Pedido</span>
                  </button>
                  <button onClick={() => setOrderOpen(true)} className="xl:hidden h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Qué hacer</span>
                  </button>
                  <AssignPicker agents={agents} assignee={active.assignee || null} onChange={assign} onManage={() => setManage('team')} />
                  <TagPicker tags={tags} selected={active.tags || []} onChange={saveConvTags} onManage={() => setManage('tags')} />
                </div>
              </div>

              {botInfo?.enabled && (
                <div className={`px-3 sm:px-4 py-1.5 sm:py-2 border-b text-xs flex items-center gap-2 ${active.bot?.paused ? 'bg-amber-50/70 border-amber-100 text-amber-900' : 'bg-violet-50/60 border-violet-100 text-violet-900'}`}>
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 min-w-0 line-clamp-2 sm:line-clamp-none" title={active.bot?.note || undefined}>
                    {active.bot?.paused ? (
                      <>
                        <strong>{botInfo.name} está en pausa</strong> en este chat
                        {active.bot.reason === 'handoff' ? ' — lo pasó a una persona' : active.bot.reason === 'limit' ? ' — llegó al límite del día' : ' — lo estás atendiendo tú'}
                        {active.bot.reason === 'handoff' && active.bot.note ? `: ${active.bot.note}` : '.'}
                      </>
                    ) : (
                      <>
                        <strong>{botInfo.name}</strong> responde este chat{botInfo.mode === 'away' ? ' fuera de horario' : ''}. Si escribes tú, se pausa.
                      </>
                    )}
                  </span>
                  <button
                    onClick={() => setBotPaused(!active.bot?.paused)}
                    disabled={botBusy}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 disabled:opacity-50 ${active.bot?.paused ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-white border border-violet-200 text-violet-800 hover:bg-violet-50'}`}
                  >
                    {botBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : active.bot?.paused ? <Sparkles className="w-3 h-3" /> : <Hand className="w-3 h-3" />}
                    <span className="sm:hidden">{active.bot?.paused ? 'Devolver' : 'Tomar'}</span>
                    <span className="hidden sm:inline">{active.bot?.paused ? 'Devolver al asistente' : 'Tomar el control'}</span>
                  </button>
                </div>
              )}

              {others.length > 0 && (
                <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100 text-[12px] text-amber-900">
                  {others.some((o) => o.typing) ? `✍️ ${others.filter((o) => o.typing).map((o) => o.name).join(' y ')} está escribiendo en este chat` : `👀 ${others.map((o) => o.name).join(' y ')} también tiene abierto este chat`}
                </div>
              )}
              <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-100/70 p-3 sm:p-4 space-y-2">
                {threadLoading && messages.length === 0 && (
                  <div className="flex justify-center py-6 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                        m.direction === 'out' ? 'bg-blue-100/80 text-slate-800 rounded-br-md' : 'bg-white text-slate-800 rounded-bl-md'
                      }`}
                    >
                      {m.type === 'template' && <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-0.5">Plantilla</p>}
                      {m.type === 'auto' && <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 mb-0.5">Respuesta automática</p>}
                      {m.type === 'followup' && (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 mb-0.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Seguimiento automático · IA
                        </p>
                      )}
                      {m.type === 'bot' && (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 mb-0.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> {botInfo?.name || 'Asistente'} · IA
                        </p>
                      )}
                      {m.media ? (
                        <div className="space-y-1">
                          <MediaView m={m} />
                          {m.media.caption && <p>{m.media.caption}</p>}
                          {m.transcript && (
                            <p className="text-[12px] text-slate-600 bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
                              <span className="font-semibold text-slate-500">📝 Dijo: </span>
                              {m.transcript}
                            </p>
                          )}
                        </div>
                      ) : (
                        m.body
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                        {m.by && <span className="font-medium text-slate-500">{m.by} ·</span>}
                        <span>{timeLabel(m.created_at)}</span>
                        <Ticks m={m} />
                      </div>
                      {m.status === 'failed' && m.error && <p className="mt-1 text-[11px] text-red-600">No enviado: {m.error}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 p-2 sm:p-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-3">
                {notConnected ? (
                  <p className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2.5">
                    WhatsApp{multi ? ` de ${storeName(active.org)}` : ''} no está conectado: no se pueden enviar respuestas.{' '}
                    <Link href="/integrations" className="font-semibold underline">
                      Ver cómo conectarlo
                    </Link>
                  </p>
                ) : !canReply ? (
                  <div className="text-xs text-slate-600 bg-slate-100 rounded-xl px-3 py-2.5 space-y-2">
                    <p>
                      {isSocialChat(active.id)
                        ? active.last_inbound_at
                          ? `Pasaron más de 24 horas desde el último mensaje: ${phoneLabel(active.id)} no deja escribirle hasta que la persona vuelva a escribir.`
                          : `La persona aún no ha respondido: ${phoneLabel(active.id)} solo deja escribirle cuando ella escriba.`
                        : active.last_inbound_at
                          ? 'Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp solo deja escribirle con una plantilla aprobada.'
                          : 'El cliente aún no ha escrito: WhatsApp solo deja iniciar la conversación con una plantilla aprobada.'}
                    </p>
                    {active.order && PENDING_ORDER.includes(active.order.status) && wa?.confirmTemplate && (
                      <button onClick={sendTemplate} disabled={tplBusy} className="h-8 px-3 rounded-lg bg-[#25D366] hover:bg-[#1ebe5a] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                        {tplBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WhatsAppIcon className="w-3.5 h-3.5" />}
                        Enviar plantilla de confirmación ({active.order.orderNumber})
                      </button>
                    )}
                    {tplMsg && <p className={tplMsg.ok ? 'text-emerald-700' : 'text-red-600'}>{tplMsg.text}</p>}
                  </div>
                ) : (
                  <>
                    {sendError && <p className="mb-2 text-xs text-red-600">{sendError}</p>}
                    <div className="relative flex flex-wrap sm:flex-nowrap items-end gap-1.5 sm:gap-2">
                      {qr.open && (
                        <QuickReplyMenu
                          replies={replies}
                          query={slashQuery}
                          highlight={qr.highlight}
                          preview={fillReply}
                          onPick={pickReply}
                          onHover={(i) => setQr((s) => ({ ...s, highlight: i }))}
                          onManage={() => {
                            setQr({ open: false, slash: false, highlight: 0 });
                            setManage('replies');
                          }}
                          onClose={() => setQr({ open: false, slash: false, highlight: 0 })}
                        />
                      )}
                      {!isSocialChat(active.id) && (
                        <ProductPhotos
                          chatId={active.id}
                          onError={setSendError}
                          onSent={async () => {
                            if (botInfo?.enabled) patchActive({ bot: { paused: true, reason: 'human', note: null } });
                            await loadMessages(active.key);
                            loadConversations();
                          }}
                        />
                      )}
                      {!isSocialChat(active.id) && (
                        <ChatAttach
                          chatId={active.id}
                          onError={setSendError}
                          onSent={async () => {
                            if (botInfo?.enabled) patchActive({ bot: { paused: true, reason: 'human', note: null } });
                            await loadMessages(active.key);
                            loadConversations();
                          }}
                        />
                      )}
                      <button
                        onClick={() => setQr((s) => (s.open ? { open: false, slash: false, highlight: 0 } : { open: true, slash: false, highlight: 0 }))}
                        className={`h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-xl border flex items-center justify-center transition ${qr.open ? 'bg-amber-50 border-amber-200 text-amber-600' : 'border-slate-200 text-slate-500 hover:text-amber-600 hover:bg-amber-50'}`}
                        aria-label="Respuestas rápidas"
                        title="Respuestas rápidas (o escribe /)"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                      <textarea
                        ref={inputRef}
                        value={text}
                        onChange={(e) => onTextChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        rows={1}
                        placeholder="Mensaje…"
                        title="Enter envía, Shift+Enter salta de línea, / para respuestas rápidas"
                        className="flex-1 min-w-0 max-sm:-order-2 max-sm:basis-[calc(100%-3rem)] resize-none text-[16px] sm:text-[14px] leading-snug bg-white border border-slate-200 rounded-xl px-3 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] max-h-40 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                      <button onClick={handleSend} disabled={!text.trim() || sending} aria-label="Enviar" className="max-sm:-order-1 h-10 sm:h-11 w-10 sm:w-auto sm:px-4 shrink-0 rounded-xl bg-brand-blue text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 disabled:bg-slate-200 disabled:text-slate-400">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span className="hidden sm:inline">Enviar</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Qué hacer / Venta */}
        {active && <div className="hidden xl:block w-[340px] shrink-0 border-l border-slate-200 p-4 overflow-y-auto">{panel}</div>}
        {active && orderOpen && (
          <div className="xl:hidden fixed inset-0 z-40 flex justify-end bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && setOrderOpen(false)}>
            <div className="w-full max-w-sm h-full bg-white p-4 overflow-y-auto relative">
              <button onClick={() => setOrderOpen(false)} className="absolute right-2 top-2 z-20 w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
              {panel}
            </div>
          </div>
        )}
      </div>
      {manage === 'tags' && <TagManager tags={tags.length || activeOrg ? tags : storeData[currentId]?.tags || []} onClose={() => setManage(null)} onSaved={() => loadConversations()} />}
      {manage === 'team' && <TeamManager onClose={() => setManage(null)} onSaved={() => loadConversations()} />}
      {manage === 'replies' && <QuickReplyManager replies={replies} onClose={() => setManage(null)} onSaved={setReplies} />}
      {newOrder && active && (
        <NewOrderModal
          prefill={{ name: active.name && !active.name.startsWith('@') ? active.name : '', phone: /^\d+$/.test(active.id) ? active.id : '', conversationId: active.id }}
          onClose={() => setNewOrder(false)}
          onCreated={() => loadConversations()}
        />
      )}
    </div>
  );
}
