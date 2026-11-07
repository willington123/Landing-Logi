'use client';

// "Nuevo pedido": an order sold by chat, typed by the team. It is saved already confirmed.
import React, { useEffect, useMemo, useState } from 'react';
import { chatOrgHeaders } from '@/lib/inbox-stores';
import Link from 'next/link';
import { Loader2, X } from 'lucide-react';
import { CO_DEPARTMENTS } from '@/lib/co-departments';
import type { OrderItem } from '@/lib/types';

interface Sellable {
  id: string;
  name: string;
  kind: 'landing' | 'product';
  image: string | null;
  country: string;
  offers: { units: number; name: string; price: number }[];
}

const input = 'w-full h-10 text-[13px] bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-brand-navy/40 focus:ring-2 focus:ring-brand-navy/10';
const cop = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

export default function NewOrderModal({
  onClose,
  onCreated,
  prefill,
}: {
  onClose: () => void;
  onCreated: (o: OrderItem) => void;
  prefill?: { name?: string; phone?: string; conversationId?: string };
}) {
  const [list, setList] = useState<Sellable[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    productId: '',
    units: 0,
    total: '',
    name: prefill?.name || '',
    phone: (prefill?.phone || '').replace(/^57(?=3\d{9}$)/, ''),
    department: '',
    city: '',
    address: '',
    neighborhood: '',
    notes: '',
  });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    fetch('/api/products', { cache: 'no-store', headers: chatOrgHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.error);
        const items: Sellable[] = (d.sellables || []).filter((s: Sellable) => s.offers.length);
        setList(items);
        if (items.length === 1) setF((x) => ({ ...x, productId: items[0].id, units: items[0].offers[0].units }));
      })
      .catch((e) => setErr(e.message || 'No pudimos cargar los productos.'));
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const product = useMemo(() => list?.find((p) => p.id === f.productId) || null, [list, f.productId]);
  const offer = product?.offers.find((o) => o.units === f.units) || null;

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...chatOrgHeaders() },
        body: JSON.stringify({ ...f, total: f.total || null, conversationId: prefill?.conversationId || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!d.success) throw new Error(d.error || `HTTP ${res.status}`);
      onCreated(d.order);
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-[560px] max-h-[94vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Nuevo pedido</h3>
            <p className="text-xs text-slate-500">Para ventas cerradas por chat. Queda confirmado, con pago contraentrega.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">
          {!list && !err && <Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto my-6" />}
          {list && !list.length && (
            <p className="text-[13px] text-slate-600">
              Primero crea el producto en{' '}
              <Link href="/productos" className="font-semibold text-brand-navy hover:underline">
                Productos
              </Link>{' '}
              (o publica una landing).
            </p>
          )}
          {list && list.length > 0 && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Producto</span>
                  <select className={`${input} mt-1`} value={f.productId} onChange={(e) => set({ productId: e.target.value, units: list.find((p) => p.id === e.target.value)?.offers[0]?.units || 0, total: '' })}>
                    <option value="">Elige…</option>
                    {list.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.kind === 'product' ? ' (WhatsApp)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Oferta</span>
                  <select className={`${input} mt-1`} value={f.units || ''} onChange={(e) => set({ units: Number(e.target.value), total: '' })} disabled={!product}>
                    {(product?.offers || []).map((o) => (
                      <option key={o.units} value={o.units}>
                        {o.name} · {cop(o.price)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Total a cobrar {offer && <span className="text-slate-400">(la oferta es {cop(offer.price)}; cámbialo solo si acordaste otro precio)</span>}</span>
                <input className={`${input} mt-1`} inputMode="numeric" value={f.total} onChange={(e) => set({ total: e.target.value.replace(/\D/g, '') })} placeholder={offer ? String(offer.price) : ''} />
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Nombre y apellido</span>
                  <input className={`${input} mt-1`} value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Celular</span>
                  <input className={`${input} mt-1`} inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="300 123 4567" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Departamento</span>
                  <select className={`${input} mt-1`} value={f.department} onChange={(e) => set({ department: e.target.value })}>
                    <option value="">Elige…</option>
                    {CO_DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Ciudad o municipio</span>
                  <input className={`${input} mt-1`} value={f.city} onChange={(e) => set({ city: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Dirección</span>
                <input className={`${input} mt-1`} value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Calle 45A # 10-20, apto 301" />
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Barrio</span>
                  <input className={`${input} mt-1`} value={f.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Nota (opcional)</span>
                  <input className={`${input} mt-1`} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Color, talla, hora de entrega…" />
                </label>
              </div>
            </>
          )}
          {err && <p className="text-[13px] text-red-600">{err}</p>}
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving || !product} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Crear pedido confirmado
          </button>
        </div>
      </div>
    </div>
  );
}
