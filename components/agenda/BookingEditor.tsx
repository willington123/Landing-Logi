'use client';

// "Página de reservas" for businesses with appointments: customize it, publish it and share it,
// with a live phone preview.
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { CalendarDays, Check, Copy, Download, ExternalLink, ImagePlus, Loader2, MessageCircle, Trash2 } from 'lucide-react';
import { slugify, type AgendaSettings } from '@/lib/agenda';
import BookingPage from '@/components/agenda/BookingPage';
import { card, input, primary } from '@/components/agenda/AgendaSetup';
import { compressImage, fileToDataUrl } from '@/lib/image-utils';

const COLORS = ['#0A6CF0', '#111827', '#0F766E', '#7C3AED', '#DB2777', '#EA580C', '#B45309', '#15803D'];

async function call(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

export default function BookingEditor() {
  const [agenda, setAgenda] = useState<AgendaSettings | null>(null);
  const [draft, setDraft] = useState<AgendaSettings | null>(null);
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState('');

  useEffect(() => {
    Promise.all([call('/api/agenda/settings'), fetch('/api/settings', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)])
      .then(([d, st]) => {
        const name = st?.settings?.storeName || st?.storeName || '';
        setStoreName(name);
        const a: AgendaSettings = d.agenda;
        // First time: suggest an address from the business name.
        const withSlug = a.bookingSlug ? a : { ...a, bookingSlug: slugify(name) };
        setAgenda(a);
        setDraft(withSlug);
      })
      .catch((e) => setError(e.message));
  }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://konnexa.lat';
  const link = draft?.bookingSlug ? `${origin}/citas/${draft.bookingSlug}` : '';
  const published = Boolean(agenda?.bookingEnabled && agenda.bookingSlug);
  const liveLink = published ? `${origin}/citas/${agenda!.bookingSlug}` : '';

  useEffect(() => {
    if (!liveLink) return setQr('');
    QRCode.toDataURL(liveLink, { width: 640, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [liveLink]);

  const preview = useMemo(() => {
    if (!draft) return null;
    return {
      business: {
        name: draft.bookingTitle || storeName || 'Tu negocio',
        intro: draft.bookingIntro,
        color: draft.bookingColor,
        cover: draft.bookingCover || null,
        showPrices: draft.bookingShowPrices,
        address: draft.address,
        policies: draft.policies,
        whatsapp: null,
        timezone: draft.timezone,
        maxDaysAhead: draft.maxDaysAhead,
      },
      services: draft.services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.price, description: s.description || '' })),
      staff: draft.staff.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, serviceIds: p.serviceIds })),
    };
  }, [draft, storeName]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!agenda || !draft || !preview) return <Loader2 className="w-5 h-5 animate-spin text-slate-400" />;

  if (agenda.businessType !== 'appointments') {
    return (
      <div className={`${card} p-6 max-w-xl space-y-2`}>
        <p className="text-sm text-slate-700">La página de reservas es para negocios con citas.</p>
        <Link href="/agenda" className="text-sm font-semibold text-[#0A6CF0]">
          Activar la agenda →
        </Link>
      </div>
    );
  }

  const set = (patch: Partial<AgendaSettings>) => setDraft({ ...draft, ...patch });
  const dirty = JSON.stringify(draft) !== JSON.stringify(agenda);
  const missing = [!draft.services.some((s) => s.active) && 'servicios', !draft.staff.some((p) => p.active) && 'profesionales con horario'].filter(Boolean) as string[];

  const save = async (patch: Partial<AgendaSettings> = {}) => {
    setSaving(true);
    setMsg(null);
    try {
      const d = await call('/api/agenda/settings', 'PUT', { ...draft, ...patch });
      setAgenda(d.agenda);
      setDraft(d.agenda);
      setMsg({ ok: true, text: d.agenda.bookingEnabled ? 'Guardado. Tu página está publicada.' : 'Guardado.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const image = await compressImage(await fileToDataUrl(file), 1600, 0.82);
      const d = await call('/api/agenda/cover', 'POST', { image });
      set({ bookingCover: d.url });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setUploading(false);
    }
  };

  const shareText = `Agenda tu cita con ${preview.business.name} aquí 👉 ${liveLink}`;

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
      <div className="space-y-4">
        {/* publish + share */}
        <div className={`${card} p-5 space-y-3`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900">Tu página de reservas</h2>
              <p className="text-xs text-slate-500">Ponla en tu Instagram, tu perfil de WhatsApp, tus anuncios o imprime el código QR para el local.</p>
            </div>
            <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${published ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
              {published ? 'Publicada' : 'Sin publicar'}
            </span>
          </div>
          {missing.length > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Antes de publicarla agrega {missing.join(' y ')} en{' '}
              <Link href="/agenda" className="font-semibold underline">
                Agenda
              </Link>
              : sin eso la página no tiene horas para ofrecer.
            </p>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Dirección de tu página</span>
            <div className="flex items-center gap-1 text-[13px] mt-1">
              <span className="text-slate-500 whitespace-nowrap">{origin.replace(/^https?:\/\//, '')}/citas/</span>
              <input className={input} placeholder="barberia-el-parche" value={draft.bookingSlug} onChange={(e) => set({ bookingSlug: slugify(e.target.value) })} />
            </div>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {!published ? (
              <button disabled={saving || missing.length > 0 || draft.bookingSlug.length < 3} onClick={() => save({ bookingEnabled: true })} className={`${primary} bg-emerald-600`}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />} Publicar mi página
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(liveLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  className={primary}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar enlace'}
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50">
                  <MessageCircle className="w-4 h-4 text-emerald-600" /> Compartir por WhatsApp
                </a>
                <a href={liveLink} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50">
                  <ExternalLink className="w-4 h-4" /> Abrir
                </a>
                {qr && (
                  <a href={qr} download={`qr-${agenda.bookingSlug}.png`} className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50">
                    <Download className="w-4 h-4" /> Descargar QR
                  </a>
                )}
              </>
            )}
          </div>
          {published && (
            <div className="flex items-center gap-4">
              {qr && <img src={qr} alt="Código QR de la página de reservas" className="w-24 h-24 rounded-lg border border-slate-200" />}
              <div className="text-xs text-slate-600 space-y-1 min-w-0">
                <p className="font-mono text-slate-800 break-all">{liveLink}</p>
                <button onClick={() => save({ bookingEnabled: false })} className="text-slate-400 hover:text-red-600">
                  Despublicar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* look */}
        <div className={`${card} p-5 space-y-4`}>
          <h3 className="text-[15px] font-semibold text-slate-900">Cómo se ve</h3>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Título</span>
            <input className={input} placeholder={storeName || 'Nombre de tu negocio'} value={draft.bookingTitle} onChange={(e) => set({ bookingTitle: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Mensaje de bienvenida</span>
            <input className={input} placeholder="Agenda tu cita en un minuto." value={draft.bookingIntro} onChange={(e) => set({ bookingIntro: e.target.value })} />
          </label>
          <div>
            <span className="text-xs font-medium text-slate-600">Color</span>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set({ bookingColor: c })}
                  className={`w-8 h-8 rounded-full border-2 ${draft.bookingColor.toLowerCase() === c.toLowerCase() ? 'border-slate-900 scale-110' : 'border-white shadow'}`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <input type="color" value={draft.bookingColor} onChange={(e) => set({ bookingColor: e.target.value })} className="w-8 h-8 rounded-full border border-slate-200 cursor-pointer" aria-label="Otro color" />
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-600">Foto de portada (tu local, tu trabajo o tu logo)</span>
            <div className="flex items-center gap-3 mt-1">
              {draft.bookingCover ? (
                <img src={draft.bookingCover} alt="" className="w-28 h-16 rounded-lg object-cover border border-slate-200" />
              ) : (
                <div className="w-28 h-16 rounded-lg border border-dashed border-slate-300 bg-slate-50" />
              )}
              <label className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} {draft.bookingCover ? 'Cambiar' : 'Subir foto'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadCover(e.target.files?.[0])} />
              </label>
              {draft.bookingCover && (
                <button onClick={() => set({ bookingCover: '' })} className="text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Quitar
                </button>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-slate-700">
            <input type="checkbox" className="accent-[#0A6CF0]" checked={draft.bookingShowPrices} onChange={(e) => set({ bookingShowPrices: e.target.checked })} /> Mostrar los precios
          </label>
          <p className="text-[11px] text-slate-500">
            Los servicios, profesionales, horarios, dirección y políticas salen de tu <Link href="/agenda" className="font-semibold text-[#0A6CF0]">Agenda</Link>.
          </p>
          <div className="flex items-center gap-3">
            <button disabled={saving || !dirty} onClick={() => save()} className={primary}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar cambios
            </button>
            {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</span>}
          </div>
        </div>
      </div>

      {/* live preview */}
      <div className="lg:sticky lg:top-6">
        <p className="text-[11px] font-semibold text-slate-500 mb-2 text-center">Vista previa</p>
        <div className="mx-auto w-[360px] h-[720px] rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-xl overflow-hidden">
          <div className="w-full h-full overflow-y-auto rounded-[1.8rem] bg-slate-50">
            <BookingPage
              slug={draft.bookingSlug || 'vista-previa'}
              preview={preview}
              previewSlotsUrl={(serviceId, date, staffId) => `/api/agenda/availability?serviceId=${encodeURIComponent(serviceId)}&date=${date}${staffId ? `&staffId=${staffId}` : ''}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
