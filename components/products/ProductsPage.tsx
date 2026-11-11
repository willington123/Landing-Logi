'use client';

// Productos: what the store sells by WhatsApp without a landing. The assistant sells them, "Nuevo pedido" uses them
// and they can be linked to Dropi.
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Image as ImageIcon, Loader2, Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { CatalogProduct, ProductOffer } from '@/lib/products';
import ProductMediaSection from '@/components/products/ProductMedia';

async function call(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}
const cop = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const input = 'w-full h-10 text-[13px] bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-brand-navy/40 focus:ring-2 focus:ring-brand-navy/10';

type Draft = Omit<CatalogProduct, 'offers' | 'updatedAt'> & { offers: (Omit<ProductOffer, 'price' | 'regularPrice'> & { price: string; regularPrice: string })[] };
const blankOffer = (units: number) => ({ id: '', name: '', units, price: '', regularPrice: '' });
const newDraft = (): Draft => ({ id: '', name: '', image: '', description: '', details: '', active: true, offers: [blankOffer(1)] });
const toDraft = (p: CatalogProduct): Draft => ({ ...p, offers: p.offers.map((o) => ({ ...o, price: String(o.price), regularPrice: o.regularPrice ? String(o.regularPrice) : '' })) });

// Photo from the phone/computer, shrunk to at most 1000 px (JPG) before upload.
function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('No pudimos leer esa imagen.'));
    img.src = url;
  });
}

export default function ProductsPage() {
  const [items, setItems] = useState<CatalogProduct[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(() => {
    call('/api/products')
      .then((d) => setItems(d.products))
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  const remove = async (p: CatalogProduct) => {
    if (!window.confirm(`¿Borrar "${p.name}"? El asistente deja de ofrecerlo. Los pedidos ya hechos no cambian.`)) return;
    await call(`/api/products?id=${encodeURIComponent(p.id)}`, 'DELETE').catch((e) => setErr(e.message));
    load();
  };
  const toggle = async (p: CatalogProduct) => {
    setItems((l) => l?.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)) || l);
    await call('/api/products', 'PUT', { product: { ...p, active: !p.active } }).catch((e) => {
      setErr(e.message);
      load();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-sm text-slate-500">Productos para WhatsApp: lo que vendes por chat sin landing. El asistente los ofrece y toma el pedido, y los usas en “Nuevo pedido”.</p>
        </div>
        <button onClick={() => setEditing(newDraft())} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> Nuevo producto
        </button>
      </div>
      {err && <p className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{err}</p>}
      {!items ? (
        <div className={`${card} py-16 flex justify-center`}>
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : !items.length ? (
        <div className={`${card} p-8 text-center`}>
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm text-slate-600">Aún no tienes productos para WhatsApp. Crea uno con su precio y sus ofertas (por ejemplo 1 unidad y 2 unidades).</p>
          <p className="mt-1 text-xs text-slate-400">Los productos de tus landings publicadas ya los conoce el asistente: no hace falta repetirlos aquí.</p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {items.map((p) => (
            <li key={p.id} className={`${card} p-4 flex gap-3 ${p.active ? '' : 'opacity-60'}`}>
              <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(toDraft(p))} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100" aria-label={`Editar ${p.name}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label={`Borrar ${p.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {p.description && <p className="text-[12px] text-slate-500 line-clamp-2">{p.description}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.offers.map((o) => (
                    <span key={o.id} className="text-[11px] font-medium bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">
                      {o.name} · {cop(o.price)}
                    </span>
                  ))}
                </div>
                <label className="mt-2 inline-flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-slate-900" checked={p.active} onChange={() => toggle(p)} />
                  {p.active ? 'El asistente lo ofrece' : 'Oculto para el asistente'}
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="pt-2">
        <ProductMediaSection key={items?.map((p) => p.id).join(',') || 'none'} />
      </div>
      <p className="text-xs text-slate-400">
        Para mandarlos a Dropi, vincúlalos con su ID en{' '}
        <Link href="/integrations" className="font-semibold text-brand-navy hover:underline">
          Integraciones → Dropi
        </Link>
        .
      </p>
      {editing && (
        <ProductEditor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductEditor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setOffer = (i: number, patch: Partial<Draft['offers'][number]>) => set({ offers: d.offers.map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await call('/api/products', 'PUT', { product: { ...d, id: d.id || undefined } });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-[620px] max-h-[94vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
          <h3 className="text-[15px] font-semibold text-slate-900">{d.id ? 'Editar producto' : 'Nuevo producto'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-4">
          <div className="flex gap-3 items-start">
            <label className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer ring-1 ring-slate-200 hover:ring-brand-blue" title="Foto del producto">
              {d.image ? <img src={d.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) set({ image: await readPhoto(f).catch(() => d.image) });
                }}
              />
            </label>
            <label className="block flex-1">
              <span className="text-xs font-medium text-slate-600">Nombre</span>
              <input className={`${input} mt-1`} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Taladro inalámbrico 21V" maxLength={80} autoFocus />
              <span className="block text-[11px] text-slate-400 mt-1">Toca el cuadro para poner una foto (opcional).</span>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Descripción corta</span>
            <textarea className="mt-1 w-full text-[13px] border border-slate-200 rounded-xl px-3 py-2" rows={2} maxLength={300} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Qué es y para quién. El asistente lo usa para presentarlo." />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Detalles (uno por línea)</span>
            <textarea
              className="mt-1 w-full text-[13px] border border-slate-200 rounded-xl px-3 py-2"
              rows={4}
              maxLength={2000}
              value={d.details}
              onChange={(e) => set({ details: e.target.value })}
              placeholder={'2 baterías de litio incluidas\nMaletín y 24 brocas\nGarantía de 3 meses'}
            />
          </label>
          <div>
            <span className="text-xs font-medium text-slate-600">Ofertas (precio final, pago contraentrega)</span>
            <div className="mt-1 space-y-2">
              {d.offers.map((o, i) => (
                <div key={i} className="grid grid-cols-[70px_1fr_1fr_32px] sm:grid-cols-[80px_1fr_120px_110px_32px] gap-2 items-center">
                  <input className={input} inputMode="numeric" value={o.units} onChange={(e) => setOffer(i, { units: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Unidades" title="Unidades" />
                  <input className={`${input} hidden sm:block`} value={o.name} onChange={(e) => setOffer(i, { name: e.target.value })} placeholder={`${o.units || 1} ${o.units === 1 ? 'unidad' : 'unidades'}`} aria-label="Nombre de la oferta" />
                  <input className={input} inputMode="numeric" value={o.price} onChange={(e) => setOffer(i, { price: e.target.value.replace(/\D/g, '') })} placeholder="Precio" aria-label="Precio" />
                  <input className={`${input} hidden sm:block`} inputMode="numeric" value={o.regularPrice} onChange={(e) => setOffer(i, { regularPrice: e.target.value.replace(/\D/g, '') })} placeholder="Antes (opc.)" aria-label="Precio antes" />
                  <button type="button" onClick={() => set({ offers: d.offers.filter((_, k) => k !== i) })} disabled={d.offers.length === 1} className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30" aria-label="Quitar oferta">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <p className="text-[11px] text-slate-400">Unidades · nombre (opcional) · precio · precio antes (opcional)</p>
              {d.offers.length < 6 && (
                <button type="button" onClick={() => set({ offers: [...d.offers, blankOffer(Math.max(0, ...d.offers.map((o) => o.units)) + 1)] })} className="text-[12.5px] font-semibold text-brand-navy hover:underline inline-flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Agregar oferta
                </button>
              )}
            </div>
          </div>
          {err && <p className="text-[13px] text-red-600">{err}</p>}
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
