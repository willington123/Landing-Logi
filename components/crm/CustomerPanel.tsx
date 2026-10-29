'use client';

// Right side of the inbox: linked order (with actions), the customer's order history and internal notes.
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, StickyNote, Trash2 } from 'lucide-react';
import type { OrderSummary } from '@/lib/server/wa-store';
import { OrderPanel, type OrderAction } from '@/components/crm/OrderPanel';
import { crmApi } from '@/components/crm/CrmParts';

interface HistoryOrder {
  id: string;
  orderNumber: string;
  productName: string;
  comboName: string;
  totalAmount: number;
  status: string;
  city: string;
  createdAt: string;
}
interface Note {
  id: string;
  text: string;
  at: string;
}

const money = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
const when = (iso: string) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function CustomerPanel({
  conversationId,
  order,
  orderChip,
  onOrderChanged,
}: {
  conversationId: string;
  order: OrderSummary | null;
  orderChip: (status: string) => React.ReactNode;
  onOrderChanged: (a: OrderAction) => void;
}) {
  const [history, setHistory] = useState<HistoryOrder[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    crmApi<{ orders: HistoryOrder[] }>(`/api/whatsapp/conversations/${conversationId}/orders`)
      .then((d) => setHistory(d.orders))
      .catch(() => setHistory([]));
  }, [conversationId]);

  useEffect(() => {
    setHistory(null);
    setNotes(null);
    setDraft('');
    setError(null);
    loadHistory();
    crmApi<{ notes: Note[] }>(`/api/whatsapp/conversations/${conversationId}/notes`)
      .then((d) => setNotes(d.notes))
      .catch(() => setNotes([]));
  }, [conversationId, loadHistory]);

  const addNote = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      const d = await crmApi<{ notes: Note[] }>(`/api/whatsapp/conversations/${conversationId}/notes`, { method: 'POST', body: JSON.stringify({ text }) });
      setNotes(d.notes);
      setDraft('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const removeNote = async (id: string) => {
    try {
      const d = await crmApi<{ notes: Note[] }>(`/api/whatsapp/conversations/${conversationId}/notes?noteId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setNotes(d.notes);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const delivered = (history || []).filter((o) => o.status === 'delivered');
  const cancelled = (history || []).filter((o) => o.status === 'cancelled').length;
  const h3 = 'text-xs font-semibold uppercase tracking-wide text-slate-400';

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className={h3}>Pedido vinculado</h3>
        {order ? (
          <OrderPanel
            order={order}
            chip={orderChip(order.status)}
            onChanged={(a) => {
              loadHistory();
              onOrderChanged(a);
            }}
          />
        ) : (
          <p className="text-[13px] text-slate-500">Esta conversación no está vinculada a ningún pedido.</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className={h3}>Historial del cliente</h3>
        {history === null ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
        ) : history.length === 0 ? (
          <p className="text-[13px] text-slate-500">No hay pedidos con este número.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-xl bg-slate-50 py-2">
                <p className="text-sm font-semibold text-slate-900">{history.length}</p>
                <p className="text-[10px] text-slate-500">pedidos</p>
              </div>
              <div className="rounded-xl bg-emerald-50 py-2">
                <p className="text-sm font-semibold text-emerald-700">{delivered.length}</p>
                <p className="text-[10px] text-emerald-700/80">entregados</p>
              </div>
              <div className={`rounded-xl py-2 ${cancelled ? 'bg-red-50' : 'bg-slate-50'}`}>
                <p className={`text-sm font-semibold ${cancelled ? 'text-red-600' : 'text-slate-900'}`}>{cancelled}</p>
                <p className={`text-[10px] ${cancelled ? 'text-red-600/80' : 'text-slate-500'}`}>cancelados</p>
              </div>
            </div>
            {delivered.length > 0 && (
              <p className="text-[11px] text-slate-500">
                Ha pagado {money(delivered.reduce((n, o) => n + (o.totalAmount || 0), 0))} en pedidos entregados.
              </p>
            )}
            <div className="space-y-1.5">
              {history.slice(0, 10).map((o) => (
                <div key={o.id} className={`rounded-xl border px-3 py-2 ${order?.id === o.id ? 'border-slate-300 bg-slate-50' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">{o.orderNumber}</span>
                    {orderChip(o.status)}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {o.comboName} · {money(o.totalAmount)} · {day(o.createdAt)}
                  </p>
                </div>
              ))}
              {history.length > 10 && <p className="text-[11px] text-slate-400">y {history.length - 10} más…</p>}
            </div>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h3 className={`${h3} flex items-center gap-1.5`}>
          <StickyNote className="w-3.5 h-3.5" /> Notas internas
        </h3>
        <p className="text-[11px] text-slate-400">Solo las ve tu equipo; el cliente no las recibe.</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote();
          }}
          rows={2}
          maxLength={1000}
          placeholder="Ej.: Prefiere que lo llamen después de las 5 pm"
          className="w-full text-[13px] bg-amber-50/40 border border-amber-200/70 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300/40"
        />
        <button
          onClick={addNote}
          disabled={!draft.trim() || saving}
          className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar nota
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="space-y-1.5">
          {(notes || []).map((n) => (
            <div key={n.id} className="group rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-[13px] text-slate-800 whitespace-pre-wrap break-words">{n.text}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400">{when(n.at)}</span>
                <button onClick={() => removeNote(n.id)} className="text-slate-300 hover:text-red-600" aria-label="Borrar nota">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
