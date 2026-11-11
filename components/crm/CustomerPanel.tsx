'use client';

// Right side of the inbox, in two tabs. "Qué hacer": what this chat needs and internal notes.
// "Venta": the linked order (what's missing, actions) and the customer's order history.
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, ShoppingBag, StickyNote, Trash2 } from 'lucide-react';
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

// Order details the store needs to ship it.
function orderGaps(o: OrderSummary) {
  const fields: [string, boolean][] = [
    ['Nombre del cliente', Boolean(o.customerName?.trim())],
    ['Teléfono', Boolean(o.phone?.trim())],
    ['Departamento', Boolean(o.department?.trim())],
    ['Ciudad', Boolean(o.city?.trim())],
    ['Dirección', Boolean(o.address?.trim())],
    ['Producto', Boolean(o.productName?.trim())],
    ['Valor de la venta', Number(o.totalAmount) > 0],
  ];
  return fields;
}

export type PanelTab = 'todo' | 'sale';

export function CustomerPanel({
  conversationId,
  order,
  orderChip,
  onOrderChanged,
  guide,
  onCreateOrder,
  tab,
  onTab,
  editCustomer,
}: {
  conversationId: string;
  order: OrderSummary | null;
  orderChip: (status: string) => React.ReactNode;
  onOrderChanged: (a: OrderAction, extra?: { carrier?: string; trackingNumber?: string; openChat?: string }) => void;
  guide?: React.ReactNode; // "Qué hacer" for this chat
  onCreateOrder?: () => void;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  editCustomer?: number; // bumps to open the order's customer data editor
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 border-b border-slate-200 -mx-4 -mt-4 bg-white sticky -top-4 z-10">
        {(
          [
            ['todo', 'Qué hacer'],
            ['sale', 'Venta'],
          ] as [PanelTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => onTab(k)}
            className={`h-12 text-[14px] font-medium border-b-2 -mb-px transition ${tab === k ? 'border-brand-blue text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'todo' ? (
        <>
          {guide}
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
        </>
      ) : (
        <>
      <section className="space-y-2">
        <h3 className={h3}>El pedido</h3>
        {order ? (
          <>
            <OrderGaps order={order} />
            <OrderPanel
              order={order}
              chip={orderChip(order.status)}
              editRequest={editCustomer}
              onChanged={(a, extra) => {
                loadHistory();
                onOrderChanged(a, extra);
              }}
            />
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-3 space-y-2">
            <p className="text-[13px] text-slate-500">Esta conversación todavía no tiene pedido.</p>
            {onCreateOrder && (
              <button onClick={onCreateOrder} className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> Crear pedido
              </button>
            )}
          </div>
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

        </>
      )}
    </div>
  );
}

function OrderGaps({ order }: { order: OrderSummary }) {
  const fields = orderGaps(order);
  const missing = fields.filter(([, ok]) => !ok).length;
  const pct = Math.round(((fields.length - missing) / fields.length) * 100);
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold text-slate-700">Datos para despachar</span>
        <span className={missing ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
          {missing ? `${missing} ${missing === 1 ? 'dato pendiente' : 'datos pendientes'}` : 'Completos'}
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${missing ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1">
        {fields.map(([label, ok]) => (
          <li key={label} className={`flex items-center gap-1.5 text-[12px] ${ok ? 'text-slate-600' : 'text-amber-700 font-medium'}`}>
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${ok ? 'bg-brand-blue border-brand-blue text-white' : 'border-amber-400'}`}>
              {ok && <Check className="w-2.5 h-2.5" />}
            </span>
            <span className="truncate">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
