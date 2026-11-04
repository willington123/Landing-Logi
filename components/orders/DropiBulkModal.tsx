'use client';

// "Para Dropi": confirmed orders in Dropi's bulk upload Excel, with what Dropi may reject marked before downloading.
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Download, Loader2, X } from 'lucide-react';
import type { OrderItem } from '@/lib/types';
import { bulkRows, downloadDropiBulk, type BulkLink } from '@/lib/dropi-bulk';

export default function DropiBulkModal({ orders, onClose, onDone }: { orders: OrderItem[]; onClose: () => void; onDone: () => void }) {
  const [links, setLinks] = useState<Record<string, BulkLink | null> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [again, setAgain] = useState(false);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/integrations/dropi', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.error || 'No pudimos leer los productos de Dropi.');
        setLinks(Object.fromEntries((d.landings || []).map((l: { id: string; link: BulkLink | null }) => [l.id, l.link])));
      })
      .catch((e) => setErr(e.message));
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  // Confirmed and not in Dropi yet (already downloaded ones only if asked).
  const candidates = useMemo(
    () => orders.filter((o) => o.status === 'confirmed_by_voice' && !o.dropi?.orderId && (again || !o.dropi?.exportedAt)),
    [orders, again],
  );
  const rows = useMemo(() => (links ? bulkRows(candidates, links) : []), [candidates, links]);
  useEffect(() => setPicked(new Set(rows.map((r) => r.order.id))), [rows]);
  const chosen = rows.filter((r) => picked?.has(r.order.id));
  const withProblems = chosen.filter((r) => r.problems.length).length;
  const downloadedBefore = orders.filter((o) => o.status === 'confirmed_by_voice' && !o.dropi?.orderId && o.dropi?.exportedAt).length;

  const download = async () => {
    if (!chosen.length) return;
    setBusy(true);
    try {
      downloadDropiBulk(chosen);
      await fetch('/api/dropi/exported', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: chosen.map((r) => r.order.id) }) });
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s || []);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-[720px] max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900">Pedidos para Dropi</h3>
            <p className="text-xs text-slate-500">
              Pedidos confirmados en el formato de carga masiva de Dropi. Súbelo en Dropi → Mis Pedidos → <b>Carga masiva de órdenes</b>.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {err && <p className="text-[13px] text-red-600">{err}</p>}
          {!links && !err && <Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto my-8" />}
          {links && (
            <>
              {downloadedBefore > 0 && (
                <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                  <input type="checkbox" className="w-4 h-4 accent-slate-900" checked={again} onChange={(e) => setAgain(e.target.checked)} />
                  Incluir {downloadedBefore === 1 ? 'el pedido que ya descargaste' : `los ${downloadedBefore} pedidos que ya descargaste`} antes
                </label>
              )}
              {!rows.length ? (
                <p className="py-10 text-center text-[13px] text-slate-500">No hay pedidos confirmados pendientes de pasar a Dropi. 👌</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {rows.map((r) => (
                    <li key={r.order.id} className="p-3 flex items-start gap-3">
                      <input type="checkbox" className="mt-1 w-4 h-4 accent-slate-900 shrink-0" checked={picked?.has(r.order.id) ?? false} onChange={() => toggle(r.order.id)} aria-label={`Incluir ${r.order.orderNumber}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-slate-900 truncate">
                          <span className="font-mono text-slate-400">{r.order.orderNumber}</span> · <b>{r.order.customerName}</b> · {r.order.productName} × {r.order.units}
                        </p>
                        <p className="text-[12px] text-slate-500 truncate">
                          {r.cells[4]}, {r.cells[3]} · ${Math.round(r.order.totalAmount).toLocaleString('es-CO')}
                          {r.order.dropi?.exportedAt && <span className="text-slate-400"> · ya descargado</span>}
                        </p>
                        {r.problems.length > 0 && (
                          <p className="text-[12px] text-amber-700 mt-0.5 flex gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {r.problems.join(' · ')}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {withProblems > 0 && (
                <p className="text-[12px] text-slate-500">
                  {withProblems === 1 ? '1 pedido tiene' : `${withProblems} pedidos tienen`} avisos: Dropi podría rechazarlos al subir el archivo. Corrige la ciudad en el pedido, o vincula el
                  producto en{' '}
                  <Link href="/integrations" className="font-semibold text-brand-navy hover:underline">
                    Integraciones → Dropi
                  </Link>
                  .
                </p>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <p className="text-[12px] text-slate-500">{chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'pedido' : 'pedidos'}` : ''}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={download}
              disabled={busy || !chosen.length}
              className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar Excel para Dropi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
