'use client';

// "Bandejas que ves": pick one, several or all of your stores to see them together (Inicio and Mensajes).
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Phone } from 'lucide-react';
import { fetchInboxStores, readSelection, saveSelection, selectedStores, STORES_EVENT, type InboxStore } from '@/lib/inbox-stores';

// The stores chosen (all of them until the person picks), kept in sync between components.
export function useInboxStores() {
  const [stores, setStores] = useState<InboxStore[] | null>(null);
  const [sel, setSel] = useState<string[] | null>(null);
  useEffect(() => {
    fetchInboxStores().then(setStores);
    setSel(readSelection());
    const sync = () => setSel(readSelection());
    window.addEventListener(STORES_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(STORES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  // Stores no longer in the account are ignored.
  const chosen = stores ? selectedStores(stores, sel) : null;
  return { stores, chosen, sel };
}

export default function StorePicker({ stores, sel, className = '' }: { stores: InboxStore[]; sel: string[] | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', out);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', out);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  if (stores.length < 2) return null;

  const chosen = selectedStores(stores, sel);
  const label = chosen.length === stores.length ? 'Todos los números' : chosen.length === 1 ? chosen[0].name : chosen.length ? `${chosen.length} tiendas` : 'Ninguna tienda';
  const toggle = (id: string) => {
    const ids = chosen.map((s) => s.id);
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    saveSelection(next.length === stores.length ? null : next);
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:border-slate-300 inline-flex items-center gap-2 max-w-full"
      >
        <Phone className="w-4 h-4 text-rose-500 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-2 left-0 w-[min(calc(100vw-2rem),380px)] bg-white rounded-2xl border border-slate-200 shadow-xl py-2">
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bandejas que ves</span>
            <span className="flex gap-3 text-[12px] font-medium">
              <button onClick={() => saveSelection(null)} disabled={chosen.length === stores.length} className="text-slate-700 disabled:text-slate-300">
                Todas
              </button>
              <button onClick={() => saveSelection([])} disabled={!chosen.length} className="text-slate-700 disabled:text-slate-300">
                Ninguna
              </button>
            </span>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {stores.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={chosen.some((c) => c.id === s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 accent-brand-blue shrink-0" />
                  <span className="flex-1 min-w-0 text-[14px] text-slate-800 truncate">{s.name}</span>
                  <span className="text-[12px] text-slate-400 shrink-0">{s.phone || (s.whatsapp ? 'WhatsApp' : 'Sin WhatsApp')}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
