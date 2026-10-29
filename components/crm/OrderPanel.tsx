'use client';

// Linked order in the WhatsApp inbox, with quick actions (confirm, cancel, ship, deliver, fix address).
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, MapPin, Package, Pencil, PackageCheck, Truck, XCircle } from 'lucide-react';
import type { OrderSummary } from '@/lib/server/wa-store';
import type { OrderStatus } from '@/lib/types';
import { crmApi } from '@/components/crm/CrmParts';
import { CARRIERS } from '@/lib/crm';

const PENDING: string[] = ['pending_call', 'retry_scheduled', 'needs_review', 'unanswered', 'calling'];
const money = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;

export type OrderAction = 'confirmed_by_voice' | 'cancelled' | 'shipped' | 'delivered' | 'address';

export function OrderPanel({
  order,
  chip,
  onChanged,
}: {
  order: OrderSummary;
  chip: React.ReactNode;
  onChanged: (action: OrderAction, extra?: { carrier?: string; trackingNumber?: string }) => void;
}) {
  const [busy, setBusy] = useState<OrderAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askCancel, setAskCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addr, setAddr] = useState({ address: order.address || '', city: order.city || '', department: order.department || '' });
  const [shipping, setShipping] = useState(false);
  const [ship, setShip] = useState({ carrier: order.carrier || '', trackingNumber: order.trackingNumber || '' });

  useEffect(() => {
    setAskCancel(false);
    setEditing(false);
    setShipping(false);
    setError(null);
    setShip({ carrier: order.carrier || '', trackingNumber: order.trackingNumber || '' });
    setAddr({ address: order.address || '', city: order.city || '', department: order.department || '' });
  }, [order.id, order.address, order.city, order.department]);

  const run = async (action: OrderAction, body: Record<string, unknown>) => {
    setBusy(action);
    setError(null);
    try {
      await crmApi(`/api/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setAskCancel(false);
      setEditing(false);
      setShipping(false);
      onChanged(action, action === 'shipped' ? { carrier: String(body.carrier || ''), trackingNumber: String(body.trackingNumber || '') } : undefined);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const setStatus = (s: OrderStatus & OrderAction) => run(s, { status: s });

  const status = order.status;
  const pending = PENDING.includes(status);
  const closed = status === 'cancelled' || status === 'delivered';
  const btn = 'h-9 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 transition';
  const spin = (a: OrderAction, icon: React.ReactNode) => (busy === a ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon);

  return (
    <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-slate-900">{order.orderNumber}</span>
        {chip}
      </div>
      <div className="flex gap-2 text-[13px] text-slate-700">
        <Package className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <span>
          {order.productName}
          <span className="block text-xs text-slate-500">{order.comboName}</span>
        </span>
      </div>
      <div className="flex justify-between text-[13px]">
        <span className="text-slate-500">Total</span>
        <span className="font-semibold text-slate-900">{money(order.totalAmount)}</span>
      </div>

      {editing ? (
        <div className="space-y-2 rounded-xl bg-slate-50 p-2.5">
          <input
            value={addr.address}
            onChange={(e) => setAddr({ ...addr, address: e.target.value })}
            placeholder="Dirección (calle, número, barrio)"
            className="w-full h-9 text-[13px] border border-slate-200 rounded-lg px-2.5 bg-white"
          />
          <div className="flex gap-2">
            <input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="Ciudad" className="w-1/2 h-9 text-[13px] border border-slate-200 rounded-lg px-2.5 bg-white" />
            <input
              value={addr.department}
              onChange={(e) => setAddr({ ...addr, department: e.target.value })}
              placeholder="Departamento"
              className="w-1/2 h-9 text-[13px] border border-slate-200 rounded-lg px-2.5 bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className={`${btn} flex-1 bg-white border border-slate-200 text-slate-600`}>
              Cancelar
            </button>
            <button onClick={() => run('address', addr)} disabled={busy !== null} className={`${btn} flex-1 bg-slate-900 text-white`}>
              {spin('address', null)} Guardar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 text-[13px] text-slate-700">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">
            {order.address}
            <span className="block text-xs text-slate-500">{[order.city, order.department].filter(Boolean).join(', ')}</span>
          </span>
          {!closed && (
            <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-slate-800 self-start" aria-label="Editar dirección" title="Editar dirección">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {order.trackingNumber && !shipping && (
        <div className="flex gap-2 text-[13px] text-slate-700">
          <Truck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">
            Guía <strong className="font-mono text-[12px]">{order.trackingNumber}</strong>
            {order.carrier && <span className="block text-xs text-slate-500">{order.carrier}</span>}
          </span>
        </div>
      )}

      {shipping && (
        <div className="space-y-2 rounded-xl bg-sky-50/60 border border-sky-100 p-2.5">
          <p className="text-[11px] text-slate-600">Datos del envío (opcionales). Se guardan en el pedido y en el Excel.</p>
          <input
            list="lp-carriers"
            value={ship.carrier}
            onChange={(e) => setShip({ ...ship, carrier: e.target.value })}
            placeholder="Transportadora (ej. Servientrega)"
            maxLength={60}
            className="w-full h-9 text-[13px] border border-slate-200 rounded-lg px-2.5 bg-white"
          />
          <datalist id="lp-carriers">
            {CARRIERS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <input
            value={ship.trackingNumber}
            onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })}
            placeholder="Número de guía"
            maxLength={60}
            className="w-full h-9 text-[13px] font-mono border border-slate-200 rounded-lg px-2.5 bg-white"
          />
          <div className="flex gap-2">
            <button onClick={() => setShipping(false)} className={`${btn} flex-1 bg-white border border-slate-200 text-slate-600`}>
              Volver
            </button>
            <button onClick={() => run('shipped', { status: 'shipped', ...ship })} disabled={busy !== null} className={`${btn} flex-1 bg-sky-600 hover:bg-sky-700 text-white`}>
              {spin('shipped', <Truck className="w-3.5 h-3.5" />)} Guardar
            </button>
          </div>
        </div>
      )}

      {!editing && !shipping && (
        <div className="grid grid-cols-2 gap-2">
          {pending && (
            <button onClick={() => setStatus('confirmed_by_voice')} disabled={busy !== null} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}>
              {spin('confirmed_by_voice', <CheckCircle2 className="w-3.5 h-3.5" />)} Confirmar
            </button>
          )}
          {status === 'confirmed_by_voice' && (
            <button onClick={() => setShipping(true)} disabled={busy !== null} className={`${btn} col-span-2 bg-sky-600 hover:bg-sky-700 text-white`}>
              {spin('shipped', <Truck className="w-3.5 h-3.5" />)} Marcar enviado
            </button>
          )}
          {status === 'shipped' && (
            <button onClick={() => setStatus('delivered')} disabled={busy !== null} className={`${btn} col-span-2 bg-green-600 hover:bg-green-700 text-white`}>
              {spin('delivered', <PackageCheck className="w-3.5 h-3.5" />)} Marcar entregado
            </button>
          )}
          {(pending || status === 'confirmed_by_voice') &&
            (askCancel ? (
              <button onClick={() => setStatus('cancelled')} disabled={busy !== null} className={`${btn} ${pending ? '' : 'col-span-2'} bg-red-600 hover:bg-red-700 text-white`}>
                {spin('cancelled', <XCircle className="w-3.5 h-3.5" />)} ¿Seguro? Cancelar
              </button>
            ) : (
              <button onClick={() => setAskCancel(true)} disabled={busy !== null} className={`${btn} ${pending ? '' : 'col-span-2'} bg-white border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-700`}>
                <XCircle className="w-3.5 h-3.5" /> Cancelar
              </button>
            ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <Link href="/orders" className="block text-center text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl py-2 transition">
        Ver pedidos
      </Link>
    </div>
  );
}
