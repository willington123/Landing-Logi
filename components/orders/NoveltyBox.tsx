'use client';

// In the order detail, once it has a tracking number: "Avisar novedad" tells the customer about a delivery problem
// with the carrier's data (name, where to pick it up, phone, tracking number, novelty, carrier). The store pastes
// what the carrier's portal shows and each field is filled in; the message is shown before sending. Outside the
// 24 h window it goes with the "aviso_novedad" template.
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPaste, Loader2, Send, X } from 'lucide-react';
import { orderOrgHeaders } from '@/lib/inbox-stores';
import { CARRIERS } from '@/lib/crm';
import { NOVELTY_REASONS, readCarrierText, type NoveltyFields } from '@/lib/wa-templates';
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

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

const empty = (o: OrderItem): NoveltyFields => ({
  summary: NOVELTY_REASONS[0].summary,
  name: titleCase((o.customerName || '').trim()),
  where: '',
  phone: (o.phone || '').trim(),
  guide: o.trackingNumber || '',
  novelty: '',
  carrier: o.carrier || '',
});

const FIELDS: { k: keyof NoveltyFields; label: string; placeholder: string; wide?: boolean }[] = [
  { k: 'name', label: 'Nombre', placeholder: 'Cristina Tejada' },
  { k: 'phone', label: 'Teléfono', placeholder: '3223641371' },
  { k: 'where', label: 'Dirección / oficina', placeholder: 'Reclama en la oficina principal de Envía en Pitalito, PITALITO-HUILA', wide: true },
  { k: 'guide', label: 'Guía', placeholder: '014165704173' },
  { k: 'novelty', label: 'Novedad (como la dice la transportadora)', placeholder: 'COORDINAR LA ENTREGA' },
];

export default function NoveltyBox({ order, onChanged }: { order: OrderItem; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<NoveltyFields>(() => empty(order));
  const [paste, setPaste] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
    setF(empty(order));
    setPaste('');
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
        const d = await call<Preview>(`/api/orders/${order.id}/novelty?f=${encodeURIComponent(JSON.stringify(f))}`, { headers: orderOrgHeaders(order) });
        setPreview(d);
        if (!edited) setMessage(d.message);
      } catch (e: any) {
        setError(e.message);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, f, order.id]);

  if (!order.trackingNumber && order.status !== 'shipped') return null;
  const last = order.novelty;
  const set = (patch: Partial<NoveltyFields>) => (setF((x) => ({ ...x, ...patch })), setEdited(false));

  // The block copied from the carrier's portal fills every field it recognizes.
  const fill = (text: string) => {
    setPaste(text);
    if (!text.trim()) return;
    const got = readCarrierText(text, CARRIERS);
    set({ ...got, ...(got.name ? { name: titleCase(got.name) } : {}) });
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await call<{ sent: boolean; error?: string; template?: boolean }>(`/api/orders/${order.id}/novelty`, {
        method: 'POST',
        headers: orderOrgHeaders(order),
        body: JSON.stringify({ fields: f, message: preview?.canText ? message : '' }),
      });
      if (d.sent) {
        setDone(d.template ? 'Novedad enviada con la plantilla.' : 'Novedad enviada al cliente.');
        setOpen(false);
        setF(empty(order));
        setPaste('');
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
  const input = 'mt-1 block w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-500/20';

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-amber-900 inline-flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Novedad de envío
        </span>
        {!open ? (
          <button type="button" onClick={() => (setOpen(true), setDone(null), setError(null))} className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-semibold">
            Avisar novedad
          </button>
        ) : (
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
          <label className="block text-[12px] text-slate-600">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <ClipboardPaste className="w-3.5 h-3.5" /> Pega aquí lo que dice la transportadora
            </span>
            <textarea
              aria-label="Texto de la transportadora"
              value={paste}
              onChange={(e) => fill(e.target.value)}
              rows={4}
              placeholder={'Cristina Tejada\nReclama en la oficina principal de envía en Pitalito, PITALITO-HUILA\nTel: 3223641371\n014165704173\nCOORDINAR LA ENTREGA    ENVIA'}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12.5px] font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <span className="text-[11px] text-slate-400">Konnexa llena los datos de abajo. Revísalos y corrige lo que haga falta.</span>
          </label>

          <div>
            <span className="text-[12px] text-slate-600">Qué pasó</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {NOVELTY_REASONS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => set({ summary: x.summary })}
                  className={`h-8 px-2.5 rounded-full text-[12px] font-medium ${f.summary === x.summary ? 'bg-amber-600 text-white' : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-50'}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <input aria-label="Qué pasó" value={f.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="es para recoger en la oficina" className={input} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FIELDS.map((x) => (
              <label key={x.k} className={`block text-[12px] text-slate-600 ${x.wide ? 'sm:col-span-2' : ''}`}>
                {x.label}
                <input aria-label={x.label} value={f[x.k]} onChange={(e) => set({ [x.k]: e.target.value } as Partial<NoveltyFields>)} placeholder={x.placeholder} className={input} />
              </label>
            ))}
            <label className="block text-[12px] text-slate-600">
              Transportadora
              <input aria-label="Transportadora" list="novelty-carriers" value={f.carrier} onChange={(e) => set({ carrier: e.target.value })} placeholder="Envía" className={input} />
              <datalist id="novelty-carriers">
                {CARRIERS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="space-y-1">
            <span className="text-[12px] font-medium text-slate-700">Mensaje para el cliente</span>
            {!preview ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
            ) : preview.canText ? (
              <textarea
                aria-label="Mensaje para el cliente"
                value={message}
                onChange={(e) => (setMessage(e.target.value), setEdited(true))}
                rows={9}
                className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            ) : (
              <>
                <p className="rounded-lg bg-white border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 whitespace-pre-wrap">{preview.message}</p>
                <p className="text-[11px] text-slate-500">
                  {!preview.whatsapp
                    ? 'WhatsApp no está conectado.'
                    : tplReady
                      ? 'El cliente no ha escrito en 24 horas: va con la plantilla «Aviso de novedad» (texto fijo).'
                      : preview.template
                        ? `El cliente no ha escrito en 24 horas y la plantilla «Aviso de novedad» aún no está aprobada por Meta (${preview.template.status}).`
                        : 'El cliente no ha escrito en 24 horas: crea la plantilla «Aviso de novedad» en Plantillas para poder avisarle.'}
                </p>
              </>
            )}
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <button
            type="button"
            onClick={send}
            disabled={busy || !preview || !!blocked || (!f.summary.trim() && !f.novelty.trim())}
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
