'use client';

// In the order detail: "Ya está en Dropi" (marked by hand) and the tracking number. After typing the number, the
// store sees the WhatsApp message for the customer, can edit it, and only sends it after confirming.
import React, { useEffect, useRef, useState } from 'react';
import { compressImage, fileToDataUrl } from '@/lib/image-utils';
import { orderOrgHeaders } from '@/lib/inbox-stores';
import { AlertTriangle, Camera, CheckCircle2, Loader2, Package, Send, Truck, X } from 'lucide-react';
import { CARRIERS } from '@/lib/crm';
import type { OrderItem } from '@/lib/types';

interface Preview {
  message: string;
  whatsapp: boolean;
  canText: boolean;
  shippedFlow: boolean;
  template?: { status: string; preview: string } | null; // "aviso_guia" when the 24 h window is closed
  photoTemplate?: { status: string } | null; // "aviso_guia_foto" (photo of the label on top)
  templateText?: string; // what either template says for this order
}

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

async function call<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...((init?.headers as Record<string, string>) || {}) } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

export default function ShippingBox({ order, onChanged }: { order: OrderItem; onChanged?: () => void }) {
  const [inDropi, setInDropi] = useState(order.inDropi || null);
  const [dropiRef, setDropiRef] = useState('');
  const [askRef, setAskRef] = useState(false);
  const [dropiBusy, setDropiBusy] = useState(false);
  const [saved, setSaved] = useState({ carrier: order.carrier || '', trackingNumber: order.trackingNumber || '', guideAt: order.guideAt || '' });
  const [carrier, setCarrier] = useState(order.carrier || '');
  const [tracking, setTracking] = useState(order.trackingNumber || '');
  const [editing, setEditing] = useState(!order.trackingNumber);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const [markShipped, setMarkShipped] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'send' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Photo of the shipping label (optional), uploaded to Storage before saving.
  const [photo, setPhoto] = useState<string | null>(order.guidePhoto || null);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(order.guidePhoto || null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInDropi(order.inDropi || null);
    setSaved({ carrier: order.carrier || '', trackingNumber: order.trackingNumber || '', guideAt: order.guideAt || '' });
    setCarrier(order.carrier || '');
    setTracking(order.trackingNumber || '');
    setEditing(!order.trackingNumber);
    setPreview(null);
    setPhoto(order.guidePhoto || null);
    setSavedPhoto(order.guidePhoto || null);
    setAskRef(false);
    setError(null);
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const apiDropi = order.dropi?.orderId;
  const cancelled = order.status === 'cancelled';

  const saveDropi = async (on: boolean) => {
    setDropiBusy(true);
    setError(null);
    try {
      const d = await call<{ inDropi: OrderItem['inDropi'] }>(`/api/orders/${order.id}`, { method: 'PATCH', headers: orderOrgHeaders(order), body: JSON.stringify({ inDropi: on, dropiRef: on ? dropiRef : '' }) });
      setInDropi(d.inDropi || null);
      setAskRef(false);
      setDropiRef('');
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDropiBusy(false);
    }
  };

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const jpg = await compressImage(await fileToDataUrl(file), 1600, 0.85);
      const blob = await (await fetch(jpg)).blob();
      const up = await call<{ uploadUrl: string; url: string }>(`/api/orders/${order.id}/guide/photo`, { method: 'POST', headers: orderOrgHeaders(order), body: JSON.stringify({ mime: 'image/jpeg', size: blob.size }) });
      const put = await fetch(up.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: blob });
      if (!put.ok) throw new Error(`No se pudo subir la foto (HTTP ${put.status}).`);
      setPhoto(up.url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPhotoBusy(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  };

  const review = async () => {
    if (!tracking.trim()) return setError('Escribe el número de guía.');
    setBusy('preview');
    setError(null);
    setDone(null);
    try {
      const d = await call<Preview>(`/api/orders/${order.id}/guide?carrier=${encodeURIComponent(carrier)}&tracking=${encodeURIComponent(tracking.trim())}`, { headers: orderOrgHeaders(order) });
      setPreview(d);
      setMessage(d.message);
      setMarkShipped(!['shipped', 'delivered', 'returned', 'cancelled'].includes(order.status));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const save = async (send: boolean) => {
    setBusy(send ? 'send' : 'save');
    setError(null);
    try {
      const d = await call<{ sent: boolean; template?: boolean; photo?: boolean; photoLater?: boolean; error?: string }>(`/api/orders/${order.id}/guide`, {
        method: 'POST',
        headers: orderOrgHeaders(order),
        body: JSON.stringify({ carrier, trackingNumber: tracking.trim(), markShipped, send, message, photo: photo || null }),
      });
      setSavedPhoto(photo);
      setPreview(null);
      setEditing(false);
      setSaved({ carrier: carrier.trim(), trackingNumber: tracking.trim(), guideAt: new Date().toISOString() });
      if (d.error) setError(d.error);
      else
        setDone(
          !d.sent
            ? 'Guía guardada. No se envió mensaje.'
            : d.photoLater
              ? 'Guía guardada y aviso enviado con la plantilla. La foto de la guía se le envía apenas el cliente responda.'
              : d.template
                ? `Guía guardada y aviso enviado al cliente con la plantilla${d.photo ? ' con foto' : ''}.`
                : `Guía guardada y ${photo ? 'foto con el mensaje enviada' : 'mensaje enviado'} al cliente por WhatsApp.`,
        );
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // Window closed + approved template: the notice goes with the template.
  const useTemplate = Boolean(preview && !preview.canText && (preview.template?.status === 'APPROVED' || (photo && preview.photoTemplate?.status === 'APPROVED')));
  const input = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10';

  return (
    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
      {/* Dropi */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-orange-500" /> Dropi
          </span>
          {inDropi || apiDropi ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ya está en Dropi
            </span>
          ) : (
            !cancelled &&
            !askRef && (
              <button onClick={() => setAskRef(true)} className="h-8 px-3 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">
                Marcar como subido
              </button>
            )
          )}
        </div>
        {inDropi && (
          <p className="text-[12px] text-slate-500">
            {inDropi.ref ? <>Pedido Dropi <b className="font-mono text-slate-700">#{inDropi.ref}</b> · </> : null}
            Marcado {when(inDropi.at)}
            {inDropi.by ? ` por ${inDropi.by}` : ''} ·{' '}
            <button onClick={() => saveDropi(false)} disabled={dropiBusy} className="font-medium text-slate-500 underline hover:text-red-600">
              Quitar
            </button>
          </p>
        )}
        {!inDropi && apiDropi && <p className="text-[12px] text-slate-500">Enviado por la conexión con Dropi · pedido #{apiDropi}</p>}
        {!inDropi && !apiDropi && askRef && (
          <div className="flex gap-2">
            <input value={dropiRef} onChange={(e) => setDropiRef(e.target.value)} placeholder="Nº de pedido en Dropi (opcional)" className={input} autoFocus />
            <button onClick={() => saveDropi(true)} disabled={dropiBusy} className="h-10 px-3 rounded-lg bg-slate-900 text-white text-[12.5px] font-semibold shrink-0 inline-flex items-center gap-1.5 disabled:opacity-50">
              {dropiBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
            </button>
            <button onClick={() => setAskRef(false)} className="h-10 px-2 text-[12.5px] text-slate-500 shrink-0">
              Cancelar
            </button>
          </div>
        )}
        {!inDropi && !apiDropi && !askRef && <p className="text-[12px] text-slate-400">{cancelled ? 'Pedido cancelado.' : 'Márcalo cuando lo subas a Dropi, así sabes cuáles faltan.'}</p>}
      </div>

      {/* Tracking number */}
      <div className="p-3 space-y-2">
        <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-sky-600" /> Guía
        </span>
        {!editing && saved.trackingNumber ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-slate-700">
              {saved.carrier || 'Transportadora'} · <span className="font-mono font-semibold">{saved.trackingNumber}</span>
              {saved.guideAt && <span className="text-slate-400 text-[12px]"> · {when(saved.guideAt)}</span>}
            </p>
            {savedPhoto && (
              <a href={savedPhoto} target="_blank" rel="noreferrer" title="Ver la foto de la guía" className="shrink-0">
                <img src={savedPhoto} alt="Foto de la guía" className="w-9 h-9 rounded-md object-cover border border-slate-200" />
              </a>
            )}
            <button onClick={() => setEditing(true)} className="text-[12.5px] font-medium text-slate-500 hover:text-slate-900 shrink-0">
              Cambiar
            </button>
          </div>
        ) : !preview ? (
          <>
            <div className="grid grid-cols-[1fr_1.2fr] gap-2">
              <select value={CARRIERS.includes(carrier) || !carrier ? carrier : '__other'} onChange={(e) => setCarrier(e.target.value === '__other' ? ' ' : e.target.value)} className={input} aria-label="Transportadora">
                <option value="">Transportadora…</option>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__other">Otra</option>
              </select>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && review()} placeholder="Número de guía" className={`${input} font-mono`} />
            </div>
            {carrier && !CARRIERS.includes(carrier) && <input value={carrier.trim()} onChange={(e) => setCarrier(e.target.value || ' ')} placeholder="Nombre de la transportadora" className={input} />}
            <div className="flex items-center gap-2">
              {photo ? (
                <span className="relative">
                  <img src={photo} alt="Foto de la guía" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
                  <button onClick={() => setPhoto(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center" aria-label="Quitar la foto">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : null}
              <button onClick={() => photoInput.current?.click()} disabled={photoBusy} className="h-9 px-3 rounded-lg border border-dashed border-slate-300 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50">
                {photoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />} {photo ? 'Cambiar foto' : 'Adjuntar foto de la guía'}
              </button>
              <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </div>
            <div className="flex gap-2">
              <button onClick={review} disabled={busy === 'preview' || !tracking.trim()} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40">
                {busy === 'preview' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar guía
              </button>
              {saved.trackingNumber && (
                <button onClick={() => (setEditing(false), setTracking(saved.trackingNumber), setCarrier(saved.carrier))} className="h-9 px-2 text-[12.5px] text-slate-500">
                  Cancelar
                </button>
              )}
            </div>
          </>
        ) : (
          // Confirm before anything reaches the customer.
          <div className="space-y-2.5">
            <p className="text-[12.5px] text-slate-600">
              Guía <span className="font-mono font-semibold text-slate-900">{tracking.trim()}</span>
              {carrier.trim() ? ` · ${carrier.trim()}` : ''}. Revisa el mensaje antes de enviarlo:
            </p>
            {useTemplate ? (
              <div className="space-y-1">
                <p className="text-[11.5px] text-slate-500">El cliente no ha escrito en 24 horas, así que va con tu plantilla aprobada «Aviso de guía{photo && preview.photoTemplate?.status === 'APPROVED' ? ' con foto' : ''}» (este texto no se puede editar):</p>
                <p className="rounded-lg border border-slate-200 bg-emerald-50/40 px-3 py-2 text-[13px] text-slate-800 whitespace-pre-wrap">{preview.template?.preview || preview.templateText}</p>
              </div>
            ) : (
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 bg-emerald-50/40 px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            )}
            {photo && (
              <div className="flex items-start gap-2.5">
                <img src={photo} alt="Foto de la guía" className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0" />
                <p className="text-[11.5px] text-slate-600">
                  {preview.canText
                    ? 'La foto va con el mensaje como texto de la foto.'
                    : preview.photoTemplate?.status === 'APPROVED'
                      ? 'Va con tu plantilla «Aviso de guía con foto»: la foto arriba y el texto debajo.'
                      : useTemplate
                        ? <>Tu plantilla «Aviso de guía» no lleva foto: la foto se le envía apenas el cliente responda. {preview.photoTemplate ? `(La plantilla con foto está en revisión: ${preview.photoTemplate.status}.)` : <>Para enviarla de una vez, <a href="/plantillas" className="font-semibold underline">crea «Aviso de guía con foto»</a>.</>}</>
                        : 'La foto queda guardada en el pedido.'}
                </p>
              </div>
            )}
            {!['shipped', 'delivered', 'returned', 'cancelled'].includes(order.status) && (
              <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
                <input type="checkbox" checked={markShipped} onChange={(e) => setMarkShipped(e.target.checked)} className="w-4 h-4 accent-brand-blue" />
                Marcar el pedido como <b>Enviado</b>
              </label>
            )}
            {!preview.whatsapp ? (
              <Warn>WhatsApp no está conectado: puedes guardar la guía, pero no enviar el mensaje.</Warn>
            ) : !preview.canText && !useTemplate ? (
              <Warn>
                {preview.template ? (
                  <>Tu plantilla «Aviso de guía» todavía no está aprobada por Meta ({preview.template.status}). Cuando la aprueben podrás enviarla; por ahora guarda la guía sin enviar.</>
                ) : (
                  <>
                    El cliente no ha escrito en las últimas 24 horas: WhatsApp solo deja enviarle una plantilla aprobada.{' '}
                    <a href="/plantillas" className="font-semibold underline">Crea la plantilla «Aviso de guía»</a> (un clic) y mientras Meta la aprueba, guarda la guía sin enviar.
                  </>
                )}
              </Warn>
            ) : null}
            {preview.shippedFlow && markShipped && <Warn>Tu flujo «Aviso de envío» también le escribe al marcarlo como Enviado. Para no avisarle dos veces, guarda sin enviar o desmarca «Enviado».</Warn>}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => save(true)}
                disabled={!!busy || !preview.whatsapp || (!preview.canText && !useTemplate) || (!useTemplate && !message.trim())}
                className="h-9 px-3 rounded-lg bg-[#25D366] hover:bg-[#1ebe5a] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                {busy === 'send' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Confirmar y enviar
              </button>
              <button onClick={() => save(false)} disabled={!!busy} className="h-9 px-3 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-40">
                {busy === 'save' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar sin enviar
              </button>
              <button onClick={() => setPreview(null)} disabled={!!busy} className="h-9 px-2 text-[12.5px] text-slate-500">
                Volver
              </button>
            </div>
          </div>
        )}
        {done && <p className="text-[12.5px] text-emerald-700">{done}</p>}
      </div>
      {error && <p className="px-3 py-2 text-[12.5px] text-red-600">{error}</p>}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-1.5 text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span>{children}</span>
    </p>
  );
}

// Small marks in the orders list: already in Dropi / has a tracking number.
export function ShipBadges({ order }: { order: OrderItem }) {
  const dropi = Boolean(order.inDropi || order.dropi?.orderId);
  if (!dropi && !order.trackingNumber) return null;
  return (
    <>
      {dropi && <span title="Ya está en Dropi" className="text-[10px] font-semibold font-sans px-1.5 py-0.5 rounded bg-orange-50 text-orange-700">Dropi</span>}
      {order.trackingNumber && (
        <span title={`Guía ${order.trackingNumber}${order.carrier ? ` · ${order.carrier}` : ''}`} className="text-[10px] font-semibold font-sans px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
          Guía
        </span>
      )}
    </>
  );
}
