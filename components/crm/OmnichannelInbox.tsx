'use client';

// WhatsApp inbox backed by Supabase (via /api/whatsapp/*). Polls every 10 s.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, CheckCheck, Clock, Loader2, MessageSquare, Package, Search, Send, X } from 'lucide-react';
import { isCloud } from '@/lib/cloud';
import type { OrderSummary, WaConversation, WaMessage } from '@/lib/server/wa-store';

type Conversation = WaConversation & { order: OrderSummary | null };
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
  confirmed_by_voice: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' },
  cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-600 ring-slate-500/15' },
  shipped: { label: 'En camino', cls: 'bg-sky-50 text-sky-700 ring-sky-600/15' },
  delivered: { label: 'Entregado', cls: 'bg-green-50 text-green-700 ring-green-600/15' },
};

const money = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;
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
  const endRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  useEffect(() => {
    isCloud().then(setCloud);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const d = await api<{ conversations: Conversation[]; whatsapp: WaStatus }>('/api/whatsapp/conversations');
      setConversations(d.conversations);
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
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...d.conversation, unread_count: c.unread_count } : c)));
      if (d.conversation.unread_count > 0) {
        await api(`/api/whatsapp/conversations/${id}/read`, { method: 'POST' });
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
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
    setMessages([]);
    setSendError(null);
    setText('');
    if (!activeId) return;
    setThreadLoading(true);
    loadMessages(activeId).finally(() => setThreadLoading(false));
  }, [activeId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const active = conversations.find((c) => c.id === activeId) || null;
  const canReply = Boolean(active?.last_inbound_at && Date.now() - new Date(active.last_inbound_at).getTime() < WINDOW_MS);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => [c.name, c.id, c.last_message, c.order?.orderNumber, c.order?.productName].some((v) => v?.toLowerCase().includes(q)));
  }, [conversations, search]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await api(`/api/whatsapp/conversations/${active.id}/messages`, { method: 'POST', body: JSON.stringify({ text: body }) });
      setText('');
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
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]" /> WhatsApp
            </h2>
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
          </div>

          <div className="flex-1 overflow-y-auto">
            {listError && <p className="m-3 text-xs text-red-600 bg-red-50 rounded-xl p-3">No se pudieron cargar las conversaciones: {listError}</p>}
            {!listError && filtered.length === 0 && (
              <div className="p-6 text-center text-[13px] text-slate-500">
                {conversations.length === 0 ? 'Aún no hay conversaciones. Aparecerán aquí cuando se envíe una confirmación de pedido o un cliente escriba a tu número de WhatsApp.' : 'Sin resultados.'}
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
                    <span className="text-[13px] font-semibold text-slate-900 truncate">{c.name || phoneLabel(c.id)}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{timeLabel(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 truncate">{c.last_message || ''}</span>
                    {c.unread_count > 0 && <span className="text-[10px] font-bold bg-[#25D366] text-white rounded-full px-1.5 min-w-[18px] text-center">{c.unread_count}</span>}
                  </div>
                  {c.order && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">{c.order.orderNumber}</span>
                      <OrderChip status={c.order.status} />
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
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{active.name || phoneLabel(active.id)}</p>
                  <p className="text-xs text-slate-500">{phoneLabel(active.id)}</p>
                </div>
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
                      {m.body}
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
                  <p className="text-xs text-slate-600 bg-slate-100 rounded-xl px-3 py-2.5">
                    {active.last_inbound_at
                      ? 'Han pasado más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite escribirle con una plantilla aprobada.'
                      : 'El cliente aún no ha escrito. WhatsApp solo permite iniciar la conversación con una plantilla aprobada.'}
                  </p>
                ) : !wa?.sending ? (
                  <p className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2.5">Conecta WhatsApp en Integraciones para poder responder.</p>
                ) : (
                  <>
                    {sendError && <p className="mb-2 text-xs text-red-600">{sendError}</p>}
                    <div className="flex items-end gap-2">
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        rows={1}
                        placeholder="Escribe una respuesta…"
                        className="flex-1 resize-none text-[13px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 max-h-32 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white"
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

        {/* Linked order */}
        {active && (
          <div className="hidden xl:flex w-72 shrink-0 border-l border-slate-200 flex-col p-4 gap-3 overflow-y-auto">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pedido vinculado</h3>
            {active.order ? (
              <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-900">{active.order.orderNumber}</span>
                  <OrderChip status={active.order.status} />
                </div>
                <div className="flex gap-2 text-[13px] text-slate-700">
                  <Package className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {active.order.productName}
                    <span className="block text-xs text-slate-500">{active.order.comboName}</span>
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">Total</span>
                  <span className="font-semibold text-slate-900">{money(active.order.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">Ciudad</span>
                  <span className="text-slate-700">{active.order.city}</span>
                </div>
                <Link href="/orders" className="block text-center text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl py-2 transition">
                  Ver pedidos
                </Link>
              </div>
            ) : (
              <p className="text-[13px] text-slate-500">Esta conversación no está vinculada a ningún pedido.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
