'use client';

// Pedidos as a board: one column per stage, cards you drag from one to the next (on phones, "Mover a…").
// Moving a card changes the order's status like everywhere else (flows, Meta sales, reports follow).
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, Truck, X } from 'lucide-react';
import { logiStore } from '@/lib/store';
import { CARRIERS } from '@/lib/crm';
import type { OrderItem, OrderStatus } from '@/lib/types';

export interface BoardColumn {
  id: string;
  label: string;
  statuses: OrderStatus[];
  target: OrderStatus; // status an order gets when dropped here
  tone: string; // header dot
}

export const BOARD_COLUMNS: BoardColumn[] = [
  { id: 'pending', label: 'Pendientes', statuses: ['pending_call', 'retry_scheduled', 'calling'], target: 'pending_call', tone: 'bg-amber-500' },
  { id: 'review', label: 'Por revisar', statuses: ['needs_review'], target: 'needs_review', tone: 'bg-indigo-500' },
  { id: 'unanswered', label: 'No contesta', statuses: ['unanswered'], target: 'unanswered', tone: 'bg-orange-500' },
  { id: 'confirmed', label: 'Confirmados', statuses: ['confirmed_by_voice'], target: 'confirmed_by_voice', tone: 'bg-emerald-500' },
  { id: 'shipped', label: 'Enviados', statuses: ['shipped'], target: 'shipped', tone: 'bg-sky-500' },
  { id: 'delivered', label: 'Entregados', statuses: ['delivered'], target: 'delivered', tone: 'bg-green-600' },
  { id: 'cancelled', label: 'Cancelados', statuses: ['cancelled'], target: 'cancelled', tone: 'bg-red-500' },
];

const PAGE = 40; // cards shown per column before "Ver más"
const money = (v: number) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const DAY = 86400000;

// How long the order has been in its stage, and whether that is too long.
export function stageAge(o: OrderItem, now = Date.now()): { days: number; since: string | null; alert: string | null } {
  const since =
    o.status === 'shipped' ? o.shippedAt || o.confirmedAt || o.createdAt : o.status === 'confirmed_by_voice' ? o.confirmedAt || o.createdAt : o.createdAt;
  const days = since ? Math.floor((now - new Date(since).getTime()) / DAY) : 0;
  let alert: string | null = null;
  if (['pending_call', 'retry_scheduled', 'needs_review', 'unanswered'].includes(o.status) && days >= 1) alert = `${days} d sin confirmar`;
  if (o.status === 'confirmed_by_voice' && days >= 2) alert = `${days} d sin despachar`;
  if (o.status === 'shipped' && days >= 6) alert = `${days} d en camino`;
  return { days, since: since || null, alert };
}

const ageLabel = (d: number) => (d <= 0 ? 'hoy' : d === 1 ? '1 día' : `${d} días`);

async function patchOrder(id: string, body: Record<string, unknown>) {
  const r = await fetch(`/api/orders/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === false) throw new Error(d.error || `HTTP ${r.status}`);
}

export default function OrdersBoard({
  orders,
  landingNames,
  onOpen,
  onChanged,
}: {
  orders: OrderItem[]; // already filtered (every filter except the status tab)
  landingNames: Record<string, string>;
  onOpen: (o: OrderItem) => void;
  onChanged: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [more, setMore] = useState<Record<string, number>>({});
  const [ship, setShip] = useState<{ order: OrderItem; carrier: string; trackingNumber: string } | null>(null);
  const [cancel, setCancel] = useState<OrderItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      BOARD_COLUMNS.map((c) => {
        const list = orders.filter((o) => c.statuses.includes(o.status)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        return { ...c, list, total: list.reduce((n, o) => n + (Number(o.totalAmount) || 0), 0) };
      }),
    [orders],
  );

  const cloud = typeof window !== 'undefined' && Boolean((window as any).__lpCloud);

  // Change the status (asks for the tracking number when it goes to Enviados, and confirms cancelling).
  const move = async (o: OrderItem, col: BoardColumn) => {
    setError(null);
    if (col.statuses.includes(o.status)) return;
    if (col.target === 'shipped') return setShip({ order: o, carrier: o.carrier || '', trackingNumber: o.trackingNumber || '' });
    if (col.target === 'cancelled') return setCancel(o);
    await apply(o, col.target);
  };

  const apply = async (o: OrderItem, status: OrderStatus, extra?: { carrier: string; trackingNumber: string }) => {
    setBusy(o.id);
    try {
      if (cloud) await patchOrder(o.id, { status, ...(extra || {}) });
      logiStore.patchOrderLocal(o.id, {
        status,
        ...(status === 'confirmed_by_voice' && !o.confirmedAt ? { confirmedAt: new Date().toISOString() } : {}),
        ...(extra ? { carrier: extra.carrier || null, trackingNumber: extra.trackingNumber || null, shippedAt: new Date().toISOString() } : {}),
      });
      onChanged();
    } catch (e: any) {
      setError(`No se pudo mover el pedido ${o.orderNumber}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none">
        {columns.map((c) => {
          const shown = c.list.slice(0, more[c.id] || PAGE);
          return (
            <section
              key={c.id}
              aria-label={c.label}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOver(c.id);
              }}
              onDragLeave={() => setOver((x) => (x === c.id ? null : x))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const o = orders.find((x) => x.id === dragId);
                setDragId(null);
                if (o) move(o, c);
              }}
              className={`snap-start shrink-0 w-[84vw] sm:w-72 rounded-2xl border flex flex-col max-h-[calc(100dvh-260px)] min-h-[200px] transition ${
                over === c.id ? 'border-brand-blue bg-brand-blue/[0.04]' : 'border-slate-200 bg-slate-100/60'
              }`}
            >
              <header className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.tone}`} />
                  <h3 className="text-[13px] font-semibold text-slate-900">{c.label}</h3>
                  <span className="ml-auto text-[12px] font-semibold text-slate-600">{c.list.length}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{money(c.total)}</p>
              </header>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                {c.list.length === 0 && <p className="text-[12px] text-slate-400 text-center py-6">Sin pedidos</p>}
                {shown.map((o) => {
                  const age = stageAge(o);
                  return (
                    <article
                      key={o.id}
                      draggable={busy !== o.id}
                      onDragStart={(e) => {
                        setDragId(o.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', o.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      onClick={() => onOpen(o)}
                      className={`bg-white rounded-xl border p-3 cursor-pointer hover:border-slate-300 active:scale-[0.99] transition shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
                        dragId === o.id ? 'opacity-50' : ''
                      } ${age.alert ? 'border-amber-300' : 'border-slate-200'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{o.customerName || 'Sin nombre'}</p>
                        {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" /> : <span className="text-[11px] text-slate-400 shrink-0 font-mono">{o.orderNumber}</span>}
                      </div>
                      <p className="text-[12px] text-slate-600 truncate mt-0.5">
                        {landingNames[o.landingPageId] || o.productName}
                        {o.comboName ? ` · ${o.comboName}` : ''}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[13px] font-semibold text-slate-900">{money(o.totalAmount)}</span>
                        <span className="text-[11px] text-slate-500 inline-flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {o.city || '—'}
                        </span>
                      </div>
                      {o.status === 'shipped' && (o.carrier || o.trackingNumber) && (
                        <p className="text-[11px] text-sky-700 mt-1 truncate inline-flex items-center gap-1">
                          <Truck className="w-3 h-3 shrink-0" />
                          {[o.carrier, o.trackingNumber].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {o.dropi?.orderId ? (
                        <p className="text-[11px] text-emerald-700 mt-1 truncate">✓ En Dropi #{o.dropi.orderId}</p>
                      ) : o.dropi?.exportedAt ? (
                        <p className="text-[11px] text-slate-500 mt-1 truncate">✓ En Excel para Dropi</p>
                      ) : o.dropi?.error ? (
                        <p className="text-[11px] text-red-600 mt-1 truncate" title={o.dropi.error}>
                          Dropi: no se pudo enviar
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 mt-2">
                        {age.alert ? (
                          <span className="text-[11px] font-semibold text-amber-700 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {age.alert}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">{ageLabel(age.days)}</span>
                        )}
                        <select
                          value=""
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const col = BOARD_COLUMNS.find((x) => x.id === e.target.value);
                            if (col) move(o, col);
                          }}
                          aria-label={`Mover el pedido ${o.orderNumber}`}
                          className="h-7 max-w-[110px] text-[11px] border border-slate-200 rounded-lg px-1.5 bg-white text-slate-600"
                        >
                          <option value="">Mover a…</option>
                          {BOARD_COLUMNS.filter((x) => !x.statuses.includes(o.status)).map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  );
                })}
                {c.list.length > shown.length && (
                  <button onClick={() => setMore((m) => ({ ...m, [c.id]: (m[c.id] || PAGE) + PAGE }))} className="w-full h-9 text-[12px] font-semibold text-slate-600 rounded-lg hover:bg-white">
                    Ver {Math.min(PAGE, c.list.length - shown.length)} más
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Moving to Enviados: carrier and tracking number (flows on "Enviado" use them). */}
      {ship && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShip(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">Marcar como enviado</h3>
            <p className="text-[13px] text-slate-600">
              Pedido {ship.order.orderNumber} · {ship.order.customerName}
            </p>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Transportadora</span>
              <input
                list="board-carriers"
                value={ship.carrier}
                onChange={(e) => setShip({ ...ship, carrier: e.target.value })}
                className="mt-1 w-full h-10 text-[13px] border border-slate-200 rounded-lg px-3"
                placeholder="Servientrega, Interrapidísimo…"
              />
              <datalist id="board-carriers">
                {CARRIERS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Número de guía</span>
              <input value={ship.trackingNumber} onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })} className="mt-1 w-full h-10 text-[13px] border border-slate-200 rounded-lg px-3 font-mono" />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShip(null)} className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
                Cancelar
              </button>
              <button
                onClick={() => {
                  const s = ship;
                  setShip(null);
                  apply(s.order, 'shipped', { carrier: s.carrier.trim(), trackingNumber: s.trackingNumber.trim() });
                }}
                className="h-10 px-4 rounded-xl bg-brand-gradient text-white text-sm font-semibold"
              >
                Marcar enviado
              </button>
            </div>
          </div>
        </div>
      )}

      {cancel && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setCancel(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">¿Cancelar el pedido {cancel.orderNumber}?</h3>
            <p className="text-[13px] text-slate-600">
              {cancel.customerName} · {money(cancel.totalAmount)}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setCancel(null)} className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
                No
              </button>
              <button
                onClick={() => {
                  const o = cancel;
                  setCancel(null);
                  apply(o, 'cancelled');
                }}
                className="h-10 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold"
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
