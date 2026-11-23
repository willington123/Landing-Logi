'use client';

// In the order detail, once it has a tracking number: "Avisar novedad" tells the customer about a delivery problem
// (pick it up at the office, coordinate the delivery, incomplete address…). The store can paste what the carrier's
// portal says; the message is shown before sending. Outside the 24 h window it goes with the "novedad_envio" template.
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Send, X } from 'lucide-react';
import { orderOrgHeaders } from '@/lib/inbox-stores';
import { CARRIERS } from '@/lib/crm';
import { NOVELTY_REASONS, type NoveltyReason } from '@/lib/wa-templates';
import type { OrderItem } from '@/lib/types';

interface Preview {
  message: string;
  whatsapp: boolean;
  canText: boolean;
  template?: { status: string } | null;
}

async function call<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...((init?.headers as Record<string, string>) || {}) } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

// What the carrier's portal shows, pasted as is:
//   Cristina Tejada / Reclama en la oficina principal de envía en Pitalito, PITALITO-HUILA / Tel: 322… / 0141657… / COORDINAR LA ENTREGA  ENVIA
// → the reason, the useful detail and the carrier; the name, phone and tracking number are dropped.
export function readCarrierText(raw: string, o: Pick<OrderItem, 'customerName' | 'trackingNumber'>): { reason: NoveltyReason; detail: string; carrier: string | null } {
  const name = fold(o.customerName || '').trim();
  let carrier: string | null = null;
  const lines = raw
    .split(/[\r\n]+/)
    .flatMap((l) => l.split(/\t+/))
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => {
      const f = fold(l);
      const c = CARRIERS.find((x) => fold(x) === f);
      if (c) return (carrier = c), false;
      if (name && f === name) return false;
      if (/^(tel|cel|telefono|celular)\b/i.test(f)) return false;
      if (/^[\d\s-]{6,}$/.test(l) || (o.trackingNumber && l.replace(/\D/g, '') === o.trackingNumber.replace(/\D/g, ''))) return false;
      return true;
    });
  const all = fold(lines.join(' '));
  const office = lines.find((l) => /reclam|oficina|recoger/i.test(fold(l)));
  if (office) return { reason: 'oficina', detail: office.replace(/^\s*(reclam\w*|recoger\w*)\s+(en\s+)?/i, ''), carrier };
  if (/direcci|nomenclatura|no existe/.test(all)) return { reason: 'direccion', detail: lines.join('. '), carrier };
  if (/ausente|no (se )?encontr|cerrado|nadie/.test(all)) return { reason: 'ausente', detail: lines.filter((l) => !/^(ausente|cliente ausente)$/i.test(l)).join('. '), carrier };
  if (/coordinar/.test(all)) return { reason: 'coordinar', detail: lines.filter((l) => !/^coordinar/i.test(fold(l))).join('. '), carrier };
  return { reason: 'otro', detail: lines.join('. '), carrier };
}

export default function NoveltyBox({ order, onChanged }: { order: OrderItem; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<NoveltyReason>('oficina');
  const [detail, setDetail] = useState('');
  const [carrier, setCarrier] = useState(order.carrier || '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
    setReason('oficina');
    setDetail('');
    setCarrier(order.carrier || '');
    setPreview(null);
    setEdited(false);
    setError(null);
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // The message for the customer, refreshed while typing.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ reason, detail, carrier });
        const d = await call<Preview>(`/api/orders/${order.id}/novelty?${q}`, { headers: orderOrgHeaders(order) });
        setPreview(d);
        if (!edited) setMessage(d.message);
      } catch (e: any) {
        setError(e.message);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reason, detail, carrier, order.id]);

  if (!order.trackingNumber && order.status !== 'shipped') return null;
  const r = NOVELTY_REASONS.find((x) => x.id === reason)!;
  const last = order.novelty;

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[\r\n\t]/.test(text)) return; // a single line: paste as usual
    e.preventDefault();
    const got = readCarrierText(text, order);
    setReason(got.reason);
    setDetail(got.detail);
    if (got.carrier && !carrier) setCarrier(got.carrier);
    setEdited(false);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await call<{ sent: boolean; error?: string; template?: boolean }>(`/api/orders/${order.id}/novelty`, {
        method: 'POST',
        headers: orderOrgHeaders(order),
        body: JSON.stringify({ reason, detail, carrier, message: preview?.canText ? message : '' }),
      });
      if (d.sent) {
        setDone(d.template ? 'Novedad enviada con la plantilla.' : 'Novedad enviada al cliente.');
        setOpen(false);
        setDetail('');
        setEdited(false);
      } else setError(d.error || 'No se pudo enviar.');
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tplReady = preview?.template?.status === 'APPROVED';
  const blocked = preview && (!preview.whatsapp || (!preview.canText && !tplReady));

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-amber-900 inline-flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Novedad de envío
        </span>
        {!open && (
          <button type="button" onClick={() => (setOpen(true), setDone(null), setError(null))} className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-semibold">
            Avisar novedad
          </button>
        )}
        {open && (
          <button type="button" aria-label="Cerrar novedad" onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-white inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {last && !open && (
        <p className="text-[12px] text-slate-600">
          Última: «{last.text}» · {when(last.at)}
          {last.by ? ` · ${last.by}` : ''} · {last.sent ? <span className="text-emerald-700">enviada</span> : <span className="text-red-600">no enviada{last.error ? `: ${last.error}` : ''}</span>}
        </p>
      )}
      {done && (
        <p className="text-[12px] text-emerald-700 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> {done}
        </p>
      )}

      {open && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {NOVELTY_REASONS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => (setReason(x.id), setEdited(false))}
                className={`h-8 px-2.5 rounded-full text-[12px] font-medium ${reason === x.id ? 'bg-amber-600 text-white' : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-50'}`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <label className="block text-[12px] text-slate-600">
            {reason === 'oficina' ? 'Dónde lo reclama' : reason === 'otro' ? 'Cuál es la novedad' : 'Detalle (opcional)'}
            <textarea
              value={detail}
              onChange={(e) => (setDetail(e.target.value), setEdited(false))}
              onPaste={onPaste}
              rows={2}
              placeholder={r.detail}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <span className="text-[11px] text-slate-400">Puedes pegar lo que dice la transportadora: Konnexa toma la novedad y quita el nombre, el teléfono y la guía.</span>
          </label>
          <label className="block text-[12px] text-slate-600">
            Transportadora
            <input
              list="novelty-carriers"
              value={carrier}
              onChange={(e) => (setCarrier(e.target.value), setEdited(false))}
              placeholder="Envía"
              className="mt-1 block w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]"
            />
            <datalist id="novelty-carriers">
              {CARRIERS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <div className="space-y-1">
            <span className="text-[12px] font-medium text-slate-700">Mensaje para el cliente{order.trackingNumber ? ` (guía ${order.trackingNumber})` : ''}</span>
            {!preview ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
            ) : preview.canText ? (
              <textarea
                value={message}
                onChange={(e) => (setMessage(e.target.value), setEdited(true))}
                rows={5}
                className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            ) : (
              <>
                <p className="rounded-lg bg-white border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 whitespace-pre-wrap">{preview.message}</p>
                <p className="text-[11px] text-slate-500">
                  {!preview.whatsapp
                    ? 'WhatsApp no está conectado.'
                    : tplReady
                      ? 'El cliente no ha escrito en 24 horas: va con la plantilla «Novedad de envío» (texto fijo).'
                      : preview.template
                        ? `El cliente no ha escrito en 24 horas y la plantilla «Novedad de envío» aún no está aprobada por Meta (${preview.template.status}).`
                        : 'El cliente no ha escrito en 24 horas: crea la plantilla «Novedad de envío» en Plantillas para poder avisarle.'}
                </p>
              </>
            )}
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <button
            type="button"
            onClick={send}
            disabled={busy || !preview || !!blocked || (reason === 'otro' && !detail.trim())}
            className="w-full h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar novedad por WhatsApp
          </button>
        </div>
      )}
      {!open && error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
