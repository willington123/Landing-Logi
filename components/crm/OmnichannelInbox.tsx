'use client';

// WhatsApp inbox backed by Supabase (via /api/whatsapp/*). Polls every 10 s.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Bell, BellOff, Bot, Check, CheckCheck, Clock, FileText, Loader2, MessageSquare, Search, Send, User, X, Zap } from 'lucide-react';
import { isCloud } from '@/lib/cloud';
import type { OrderSummary, WaConversation, WaMessage } from '@/lib/server/wa-store';
import { fillQuickReply, type CrmTag, type QuickReply } from '@/lib/crm';
import { AgentBadge, AssignPicker, QuickReplyManager, QuickReplyMenu, TagChip, TagManager, TagPicker, crmApi, matchReplies } from '@/components/crm/CrmParts';
import { type OrderAction } from '@/components/crm/OrderPanel';
import { CustomerPanel } from '@/components/crm/CustomerPanel';
import { SOUND_EVENT, UNREAD_REFRESH_EVENT, playMessageSound, setSoundOn, soundOn } from '@/lib/notify';

type Conversation = WaConversation & { order: OrderSummary | null; tags?: string[]; assignee?: string | null };
type Filter = 'all' | 'unread' | 'unanswered' | 'pending' | 'confirmed' | 'mine' | 'unassigned';
const ME_KEY = 'lp_agent'; // who is using this browser (for "Míos")
const PENDING_ORDER = ['pending_call', 'retry_scheduled', 'needs_review', 'unanswered', 'calling'];

// The customer wrote last and nobody has answered yet.
const isUnanswered = (c: Conversation) => Boolean(c.last_inbound_at && (!c.last_message_at || c.last_inbound_at >= c.last_message_at));
const waitingFor = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'ahora' : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`;
};
interface WaStatus {
  sending: boolean;
  confirmTemplate: boolean;
  webhook: boolean;
  missing: string[];
}

const POLL_MS = 10_000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c4.55 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.28-2.42 5.84a8.17 8.17 0 01-5.83 2.41c-1.47 0-2.92-.39-4.18-1.14l-.3-.18-3.11.82.83-3.03-.2-.31a8.192 8.192 0 01-1.26-4.41c0-4.54 3.7-8.24 8.23-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8 2.53 1.09 2.53.73 2.99.69.45-.04 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
    </svg>
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
const phoneLabel = (p: string) => `+${p}`;

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

function OrderChip({ status }: { status: string }) {
  const s = ORDER_STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-600 ring-slate-500/15' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}

function Ticks({ m }: { m: WaMessage }) {
  if (m.direction !== 'out') return null;
  if (m.status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
  if (m.status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-sky-500" />;
  if (m.status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
  if (m.status === 'sent') return <Check className="w-3.5 h-3.5 text-slate-400" />;
  return <Clock className="w-3.5 h-3.5 text-slate-300" />;
}

// Photo, voice note, video, document or sticker the customer sent (streamed through /api/whatsapp/media).
function MediaView({ m }: { m: WaMessage }) {
  const [failed, setFailed] = useState(false);
  const media = m.media!;
  const src = `/api/whatsapp/media/${media.id}`;
  if (failed) return <p className="text-xs text-slate-500 italic">El archivo ya no está disponible en WhatsApp (se guarda unos 30 días).</p>;
  if (media.kind === 'image' || media.kind === 'sticker')
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block">
        <img src={src} alt={media.caption || 'Foto del cliente'} onError={() => setFailed(true)} className={`rounded-xl ${media.kind === 'sticker' ? 'w-28 h-28 object-contain' : 'max-h-72 w-auto max-w-full object-cover'}`} />
      </a>
    );
  if (media.kind === 'audio') return <audio controls preload="none" src={src} onError={() => setFailed(true)} className="w-64 max-w-full h-10" />;
  if (media.kind === 'video') return <video controls preload="metadata" src={src} onError={() => setFailed(true)} className="rounded-xl max-h-72 max-w-full" />;
  const name = media.filename || 'documento';
  return (
    <a href={`${src}?name=${encodeURIComponent(name)}`} className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 hover:bg-slate-100">
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
      <span title={title} className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-500/15">
        <Clock className="w-3 h-3" /> Ventana cerrada
      </span>
    );
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const urgent = left < 2 * 3600000;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${urgent ? 'bg-amber-50 text-amber-800 ring-amber-600/20' : 'bg-emerald-50 text-emerald-700 ring-emerald-600/15'}`}
    >
      <Clock className="w-3 h-3" /> {h ? `${h} h ${m} min` : `${m} min`}
      <span className="hidden sm:inline"> para responder</span>
    </span>
  );
}

export default function OmnichannelInbox() {
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [wa, setWa] = useState<WaStatus | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>('');
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [agents, setAgents] = useState<CrmTag[]>([]);
  const [me, setMe] = useState('');
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [manage, setManage] = useState<'tags' | 'replies' | 'team' | null>(null);
  // Quick reply menu: open with ⚡ (query typed in the box is ignored) or by typing "/atajo".
  const [qr, setQr] = useState<{ open: boolean; slash: boolean; highlight: number }>({ open: false, slash: false, highlight: 0 });
  const [orderOpen, setOrderOpen] = useState(false); // customer drawer on small screens
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(true);
  const [tplBusy, setTplBusy] = useState(false);
  const [tplMsg, setTplMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

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

  const loadConversations = useCallback(async () => {
    try {
      const d = await api<{ conversations: Conversation[]; tags: CrmTag[]; agents: CrmTag[]; whatsapp: WaStatus }>('/api/whatsapp/conversations');
      setConversations(d.conversations);
      if (d.tags) setTags(d.tags);
      if (d.agents) setAgents(d.agents);
      setWa(d.whatsapp);
      setListError(null);
    } catch (e: any) {
      setListError(e.message);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const d = await api<{ messages: WaMessage[]; conversation: Conversation }>(`/api/whatsapp/conversations/${id}/messages`);
      if (activeRef.current !== id) return;
      // Only replace when something changed, so polling doesn't re-scroll the thread.
      const sig = (ms: WaMessage[]) => ms.map((m) => `${m.id}:${m.status}`).join('|');
      setMessages((prev) => (sig(prev) === sig(d.messages) ? prev : d.messages));
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...d.conversation, tags: c.tags, assignee: c.assignee, unread_count: c.unread_count } : c)));
      if (d.conversation.unread_count > 0) {
        await api(`/api/whatsapp/conversations/${id}/read`, { method: 'POST' });
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
        window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT));
      }
    } catch {
      // Keep what is on screen; the next poll retries.
    }
  }, []);

  // Poll the list (and the open thread) while the tab is visible.
  useEffect(() => {
    if (!cloud) return;
    loadConversations();
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadConversations();
      if (activeRef.current) loadMessages(activeRef.current);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [cloud, loadConversations, loadMessages]);

  useEffect(() => {
    if (!cloud) return;
    crmApi<{ items: QuickReply[] }>('/api/whatsapp/quick-replies')
      .then((d) => setReplies(d.items))
      .catch(() => {});
  }, [cloud]);

  useEffect(() => {
    setMessages([]);
    setSendError(null);
    setText('');
    setQr({ open: false, slash: false, highlight: 0 });
    setOrderOpen(false);
    setTplMsg(null);
    if (!activeId) return;
    setThreadLoading(true);
    loadMessages(activeId).finally(() => setThreadLoading(false));
  }, [activeId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Grow the reply box with its text (up to ~6 lines).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const active = conversations.find((c) => c.id === activeId) || null;
  const left = windowLeft(active?.last_inbound_at, now);
  const canReply = left > 0;

  const sendTemplate = async () => {
    if (!active?.order) return;
    setTplBusy(true);
    setTplMsg(null);
    try {
      await crmApi('/api/whatsapp/confirm', { method: 'POST', body: JSON.stringify({ orderId: active.order.id }) });
      setTplMsg({ ok: true, text: 'Plantilla enviada. Cuando el cliente responda, se abre de nuevo la ventana de 24 horas.' });
      loadMessages(active.id);
      loadConversations();
    } catch (e: any) {
      setTplMsg({ ok: false, text: e.message });
    } finally {
      setTplBusy(false);
    }
  };

  const tagById = useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t])), [tags]);
  const counts = useMemo(
    () => ({
      unread: conversations.filter((c) => c.unread_count > 0).length,
      unanswered: conversations.filter(isUnanswered).length,
      pending: conversations.filter((c) => c.order && PENDING_ORDER.includes(c.order.status)).length,
      confirmed: conversations.filter((c) => c.order?.status === 'confirmed_by_voice').length,
      mine: me ? conversations.filter((c) => c.assignee === me).length : 0,
      unassigned: conversations.filter((c) => !c.assignee).length,
    }),
    [conversations, me],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'unread' && !(c.unread_count > 0)) return false;
      if (filter === 'unanswered' && !isUnanswered(c)) return false;
      if (filter === 'pending' && !(c.order && PENDING_ORDER.includes(c.order.status))) return false;
      if (filter === 'confirmed' && c.order?.status !== 'confirmed_by_voice') return false;
      if (filter === 'mine' && (!me || c.assignee !== me)) return false;
      if (filter === 'unassigned' && c.assignee) return false;
      if (tagFilter && !(c.tags || []).includes(tagFilter)) return false;
      if (!q) return true;
      const tagNames = (c.tags || []).map((id) => tagById[id]?.name);
      return [c.name, c.id, c.last_message, c.order?.orderNumber, c.order?.productName, c.order?.customerName, ...tagNames].some((v) => v?.toLowerCase().includes(q));
    });
  }, [conversations, search, filter, tagFilter, tagById, me]);
  const agentById = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents]);
  const meAgent = agentById[me] || null;
  const chooseMe = (id: string) => {
    setMe(id);
    try {
      if (id) localStorage.setItem(ME_KEY, id);
      else localStorage.removeItem(ME_KEY);
    } catch {}
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

  // ---------- tags and order actions ----------

  const assign = async (agentId: string | null) => {
    if (!active) return;
    const id = active.id;
    const d = await crmApi<{ assignee: string | null }>(`/api/whatsapp/conversations/${id}/assign`, { method: 'PUT', body: JSON.stringify({ agentId }) });
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, assignee: d.assignee } : c)));
  };

  const saveConvTags = async (ids: string[]) => {
    if (!active) return;
    const id = active.id;
    const d = await crmApi<{ tags: string[] }>(`/api/whatsapp/conversations/${id}/tags`, { method: 'PUT', body: JSON.stringify({ tags: ids }) });
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, tags: d.tags } : c)));
  };

  const onOrderChanged = async (action: OrderAction, extra?: { carrier?: string; trackingNumber?: string }) => {
    await loadConversations();
    // After shipping, leave the "despachado" message (with the tracking number if given) ready to review and send.
    if (action === 'shipped' && canReply && !text.trim()) {
      const vars = { ...replyVars(active), transportadora: extra?.carrier || '', guia: extra?.trackingNumber || '' };
      const withGuide = extra?.trackingNumber ? replies.find((x) => x.shortcut === 'guia') : null;
      const r = withGuide || replies.find((x) => x.shortcut === 'envio');
      if (r) setText(fillQuickReply(r.body, vars));
      else if (extra?.trackingNumber)
        setText(fillQuickReply('Hola {nombre} 🚚 Tu pedido {pedido} ya va en camino con {transportadora}. Número de guía: {guia}.', vars));
    }
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await api(`/api/whatsapp/conversations/${active.id}/messages`, { method: 'POST', body: JSON.stringify({ text: body }) });
      setText('');
      setQr({ open: false, slash: false, highlight: 0 });
      await loadMessages(active.id);
      loadConversations();
    } catch (e: any) {
      setSendError(e.message);
      loadMessages(active.id);
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

  return (
    <div className={`${card} flex-1 flex flex-col min-h-0 overflow-hidden text-slate-800`}>
      {wa && !wa.sending && (
        <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50 text-[13px] text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            WhatsApp todavía no está conectado: no se envían confirmaciones ni respuestas.{' '}
            <Link href="/integrations" className="font-semibold underline">
              Ver cómo conectarlo
            </Link>
          </span>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Conversation list */}
        <div className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-80 shrink-0 border-r border-slate-200 flex-col min-h-0`}>
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> WhatsApp
              </h2>
              <div className="flex items-center gap-0.5">
              <Link
                href="/automations"
                className="h-7 px-2 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 text-slate-600 hover:bg-slate-100"
                title="Respuestas automáticas por palabra clave y fuera de horario"
              >
                <Bot className="w-3.5 h-3.5" /> Auto
              </Link>
              <button
                onClick={() => {
                  setSoundOn(!sound);
                  if (!sound) playMessageSound();
                }}
                className={`h-7 px-2 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 ${sound ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-100'}`}
                title={sound ? 'Sonido de mensaje nuevo activado' : 'Sonido de mensaje nuevo desactivado'}
              >
                {sound ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />} {sound ? 'Sonido' : 'Silencio'}
              </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">{conversations.length} conversaciones</p>
            <div className="relative mt-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, teléfono o pedido"
                className="w-full text-[13px] bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Limpiar">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'Todos', null],
                  ['unread', 'Sin leer', counts.unread],
                  ['unanswered', 'Sin responder', counts.unanswered],
                  ['pending', 'Pendientes', counts.pending],
                  ['confirmed', 'Confirmados', counts.confirmed],
                  ...(agents.length
                    ? ([
                        ['mine', meAgent ? 'Míos' : 'Míos (elige quién eres)', counts.mine],
                        ['unassigned', 'Sin asignar', counts.unassigned],
                      ] as [Filter, string, number | null][])
                    : []),
                ] as [Filter, string, number | null][]
              ).map(([k, label, n]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1 transition ${
                    filter === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                  {n ? <span className={`text-[10px] font-bold ${filter === k ? 'text-white/80' : k === 'unanswered' ? 'text-red-600' : 'text-slate-500'}`}>{n}</span> : null}
                </button>
              ))}
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="flex-1 h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white text-slate-700"
                  aria-label="Filtrar por etiqueta"
                >
                  <option value="">Todas las etiquetas</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => setManage('tags')} className="text-[11px] font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap">
                  Editar etiquetas
                </button>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              {agents.length > 0 ? (
                <select
                  value={me}
                  onChange={(e) => chooseMe(e.target.value)}
                  className="flex-1 h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white text-slate-700"
                  aria-label="¿Quién eres?"
                  title="Se recuerda en este navegador. Sirve para el filtro Míos."
                >
                  <option value="">¿Quién eres? (para “Míos”)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      Soy {a.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 text-[11px] text-slate-400">¿Trabajas con más personas? Repártanse los chats.</span>
              )}
              <button onClick={() => setManage('team')} className="text-[11px] font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap">
                {agents.length ? 'Editar equipo' : 'Agregar equipo'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listError && <p className="m-3 text-xs text-red-600 bg-red-50 rounded-xl p-3">No se pudieron cargar las conversaciones: {listError}</p>}
            {!listError && filtered.length === 0 && (
              <div className="p-6 text-center text-[13px] text-slate-500">
                {conversations.length === 0
                  ? 'Aún no hay conversaciones. Aparecerán aquí cuando se envíe una confirmación de pedido o un cliente escriba a tu número de WhatsApp.'
                  : filter === 'unanswered' && !search && !tagFilter
                    ? '¡Al día! No hay chats esperando respuesta.'
                    : 'Sin resultados.'}
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 flex gap-3 transition ${c.id === activeId ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {(c.name || '#').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-slate-900 truncate flex items-center gap-1.5">
                      {c.assignee && agentById[c.assignee] && <AgentBadge agent={agentById[c.assignee]} />}
                      <span className="truncate">{c.name || phoneLabel(c.id)}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">{timeLabel(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 truncate">{preview(c.last_message)}</span>
                    {c.unread_count > 0 && <span className="text-[10px] font-bold bg-[#25D366] text-white rounded-full px-1.5 min-w-[18px] text-center">{c.unread_count}</span>}
                  </div>
                  {(c.order || isUnanswered(c) || (c.tags || []).length > 0) && (
                    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                      {isUnanswered(c) && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600" title="El cliente espera respuesta">
                          <Clock className="w-3 h-3" /> {waitingFor(c.last_inbound_at!)}
                        </span>
                      )}
                      {c.order && (
                        <>
                          <span className="text-[11px] text-slate-400">{c.order.orderNumber}</span>
                          <OrderChip status={c.order.status} />
                        </>
                      )}
                      {(c.tags || []).map((id) => tagById[id] && <TagChip key={id} tag={tagById[id]} small />)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 min-h-0`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-slate-400 p-6 text-center">Selecciona una conversación</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                <button onClick={() => setActiveId('')} className="md:hidden p-1 -ml-1 text-slate-500" aria-label="Volver">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{active.name || phoneLabel(active.id)}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-slate-500 mr-1">{phoneLabel(active.id)}</span>
                    <WindowChip left={left} />
                    {(active.tags || []).map((id) => tagById[id] && <TagChip key={id} tag={tagById[id]} small />)}
                  </div>
                </div>
                <button
                  onClick={() => setOrderOpen(true)}
                  className="xl:hidden h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cliente</span>
                </button>
                <AssignPicker agents={agents} assignee={active.assignee || null} onChange={assign} onManage={() => setManage('team')} />
                <TagPicker tags={tags} selected={active.tags || []} onChange={saveConvTags} onManage={() => setManage('tags')} />
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 space-y-2">
                {threadLoading && messages.length === 0 && (
                  <div className="flex justify-center py-6 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                        m.direction === 'out' ? 'bg-emerald-50 border border-emerald-100 text-slate-800' : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                    >
                      {m.type === 'template' && <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-0.5">Plantilla</p>}
                      {m.type === 'auto' && <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 mb-0.5">Respuesta automática</p>}
                      {m.media ? (
                        <div className="space-y-1">
                          <MediaView m={m} />
                          {m.media.caption && <p>{m.media.caption}</p>}
                        </div>
                      ) : (
                        m.body
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                        <span>{timeLabel(m.created_at)}</span>
                        <Ticks m={m} />
                      </div>
                      {m.status === 'failed' && m.error && <p className="mt-1 text-[11px] text-red-600">No enviado: {m.error}</p>}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="border-t border-slate-100 p-3">
                {!canReply ? (
                  <div className="text-xs text-slate-600 bg-slate-100 rounded-xl px-3 py-2.5 space-y-2">
                    <p>
                      {active.last_inbound_at
                        ? 'Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp solo deja escribirle con una plantilla aprobada.'
                        : 'El cliente aún no ha escrito: WhatsApp solo deja iniciar la conversación con una plantilla aprobada.'}
                    </p>
                    {active.order && PENDING_ORDER.includes(active.order.status) && wa?.confirmTemplate && (
                      <button
                        onClick={sendTemplate}
                        disabled={tplBusy}
                        className="h-8 px-3 rounded-lg bg-[#25D366] hover:bg-[#1ebe5a] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {tplBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WhatsAppIcon className="w-3.5 h-3.5" />}
                        Enviar plantilla de confirmación ({active.order.orderNumber})
                      </button>
                    )}
                    {tplMsg && <p className={tplMsg.ok ? 'text-emerald-700' : 'text-red-600'}>{tplMsg.text}</p>}
                  </div>
                ) : !wa?.sending ? (
                  <p className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2.5">Conecta WhatsApp en Integraciones para poder responder.</p>
                ) : (
                  <>
                    {sendError && <p className="mb-2 text-xs text-red-600">{sendError}</p>}
                    <div className="relative flex items-end gap-2">
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
                      <button
                        onClick={() => setQr((s) => (s.open ? { open: false, slash: false, highlight: 0 } : { open: true, slash: false, highlight: 0 }))}
                        className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center transition ${qr.open ? 'bg-amber-50 border-amber-200 text-amber-600' : 'border-slate-200 text-slate-500 hover:text-amber-600 hover:bg-amber-50'}`}
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
                        placeholder="Escribe… o / para respuestas rápidas"
                        className="flex-1 resize-none text-[13px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 max-h-40 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        className="h-9 px-3 rounded-xl bg-slate-900 text-white text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-40"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Customer: linked order, history and notes */}
        {active && (
          <div className="hidden xl:block w-80 shrink-0 border-l border-slate-200 p-4 overflow-y-auto">
            <CustomerPanel conversationId={active.id} order={active.order} orderChip={(st) => <OrderChip status={st} />} onOrderChanged={onOrderChanged} />
          </div>
        )}
        {active && orderOpen && (
          <div className="xl:hidden fixed inset-0 z-40 flex justify-end bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && setOrderOpen(false)}>
            <div className="w-full max-w-sm h-full bg-white p-4 overflow-y-auto">
              <div className="flex justify-end -mb-2">
                <button onClick={() => setOrderOpen(false)} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center" aria-label="Cerrar">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <CustomerPanel conversationId={active.id} order={active.order} orderChip={(st) => <OrderChip status={st} />} onOrderChanged={onOrderChanged} />
            </div>
          </div>
        )}
      </div>
      {manage === 'tags' && <TagManager tags={tags} onClose={() => setManage(null)} onSaved={(t) => (setTags(t), loadConversations())} />}
      {manage === 'team' && (
        <TagManager
          tags={agents}
          title="Equipo"
          endpoint="/api/whatsapp/agents"
          intro="Las personas que responden los chats. Asigna cada chat a alguien y cada uno ve los suyos con el filtro “Míos”. Todos entran con la misma contraseña del panel."
          addLabel="Agregar persona"
          placeholder="Nombre"
          onClose={() => setManage(null)}
          onSaved={(a) => (setAgents(a), loadConversations())}
        />
      )}
      {manage === 'replies' && <QuickReplyManager replies={replies} onClose={() => setManage(null)} onSaved={setReplies} />}
    </div>
  );
}
