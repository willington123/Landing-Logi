'use client';

// Productos → "Fotos y nota de voz": what the AI assistant sends in WhatsApp for each product (landings and WhatsApp
// products). The audio is turned into a voice note and transcribed once, so the assistant knows what it says.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Mic, Plus, Square, Trash2, Upload, X } from 'lucide-react';
import { MAX_AUDIO_SECONDS, MAX_MEDIA_IMAGES, type MediaImage, type ProductMedia } from '@/lib/product-media';

interface Item {
  id: string;
  name: string;
  kind: 'landing' | 'product';
  image: string | null;
  media: ProductMedia;
}

async function call(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || (res.status === 413 ? 'El archivo es muy pesado.' : `HTTP ${res.status}`));
  return d;
}
const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const input = 'w-full h-9 text-[12.5px] bg-white border border-slate-200 rounded-lg px-2.5 outline-none focus:border-brand-navy/40';
const secs = (n: number | null) => (n === null ? '' : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`);
const toDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No pudimos leer el archivo.'));
    r.readAsDataURL(b);
  });

// Photo shrunk to at most 1200 px (JPG) before upload.
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1200 / Math.max(img.width, img.height));
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

export default function ProductMediaSection() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Item | null>(null);
  const load = useCallback(() => {
    call('/api/products/media')
      .then((d) => setItems(d.products))
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900">Fotos y nota de voz para el asistente</h3>
        <p className="text-[12.5px] text-slate-500">
          El asistente se las envía al cliente por WhatsApp cuando pregunta por el producto, <b>una sola vez</b>. La nota de voz llega como si la hubieras grabado en el chat, y el asistente
          sabe lo que dice.
        </p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {!items ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
      ) : !items.length ? (
        <p className="text-[12.5px] text-slate-500">Crea un producto o publica una landing para cargarle fotos y nota de voz.</p>
      ) : (
        <ul className={`${card} divide-y divide-slate-100`}>
          {items.map((it) => (
            <li key={it.id} className="p-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                {it.media.images[0]?.url || it.image ? <img src={it.media.images[0]?.url || it.image!} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-slate-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-900 truncate">
                  {it.name}
                  <span className={`ml-1.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 align-middle ${it.kind === 'product' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
                    {it.kind === 'product' ? 'WhatsApp' : 'Landing'}
                  </span>
                </p>
                <p className="text-[12px] text-slate-500">
                  {it.media.images.length ? `📷 ${it.media.images.length} ${it.media.images.length === 1 ? 'foto' : 'fotos'}` : 'Sin fotos'} ·{' '}
                  {it.media.audio ? `🎤 nota de voz ${secs(it.media.audio.seconds)}` : 'sin nota de voz'}
                </p>
              </div>
              <button onClick={() => setOpen(it)} className="h-9 px-3 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 shrink-0">
                {it.media.images.length || it.media.audio ? 'Editar' : 'Agregar'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <MediaEditor
          item={open}
          onClose={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MediaEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const [images, setImages] = useState<MediaImage[]>(item.media.images);
  const [audio, setAudio] = useState(item.media.audio);
  const [transcript, setTranscript] = useState(item.media.audio?.transcript || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [rec, setRec] = useState<{ r: MediaRecorder; start: number } | null>(null);
  const [tick, setTick] = useState(0);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => {
      setTick(Math.floor((Date.now() - rec.start) / 1000));
      if (Date.now() - rec.start > MAX_AUDIO_SECONDS * 1000) rec.r.stop();
    }, 250);
    return () => clearInterval(t);
  }, [rec]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose, busy]);

  const flash = (m: string) => {
    setSaved(m);
    setTimeout(() => setSaved(null), 2500);
  };
  const savePhotos = async () => {
    setBusy('photos');
    setErr(null);
    try {
      const d = await call('/api/products/media', 'POST', { productId: item.id, images });
      setImages(d.images);
      flash('Fotos guardadas');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };
  const sendAudio = async (blob: Blob) => {
    if (blob.size > 3.2 * 1024 * 1024) return setErr('El audio pesa más de 3 MB. Usa uno más corto (hasta unos 3 minutos) o grábalo aquí.');
    setBusy('audio');
    setErr(null);
    try {
      const d = await call('/api/products/media', 'POST', { productId: item.id, audio: await toDataUrl(blob) });
      setAudio(d.media.audio);
      setTranscript(d.media.audio?.transcript || '');
      flash(d.media.audio?.transcript ? 'Nota de voz lista y transcrita' : 'Nota de voz lista. Escribe abajo lo que dice para que el asistente lo sepa.');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };
  const record = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
        if (blob.size) sendAudio(blob);
      };
      r.start();
      setTick(0);
      setRec({ r, start: Date.now() });
    } catch {
      setErr('No pudimos usar el micrófono. Revisa el permiso del navegador o sube un archivo de audio.');
    }
  };
  const saveTranscript = async () => {
    setBusy('text');
    setErr(null);
    try {
      await call('/api/products/media', 'POST', { productId: item.id, transcript });
      flash('Texto guardado');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };
  const removeAudio = async () => {
    if (!window.confirm('¿Quitar la nota de voz de este producto?')) return;
    setBusy('audio');
    try {
      await call(`/api/products/media?productId=${encodeURIComponent(item.id)}`, 'DELETE');
      setAudio(null);
      setTranscript('');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white w-full sm:max-w-[640px] max-h-[94vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900">Fotos y nota de voz</h3>
            <p className="text-xs text-slate-500 truncate">{item.name}</p>
          </div>
          <button onClick={onClose} disabled={Boolean(busy)} className="text-slate-400 hover:text-slate-700 p-1 disabled:opacity-40" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-5">
          {/* photos */}
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-slate-900">
              📷 Fotos <span className="font-normal text-slate-500">({images.length}/{MAX_MEDIA_IMAGES})</span>
            </p>
            <p className="text-[11.5px] text-slate-500">Escribe qué muestra cada una (opcional): el asistente lo usa para saber cuál enviar, y va como texto de la foto.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="relative aspect-square bg-slate-100">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setImages(images.filter((_, k) => k !== i))} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 text-slate-600 hover:text-red-600 flex items-center justify-center" aria-label="Quitar foto">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input className={`${input} rounded-none border-0 border-t`} value={img.caption} maxLength={120} placeholder="Qué muestra (opcional)" onChange={(e) => setImages(images.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)))} />
                </div>
              ))}
              {images.length < MAX_MEDIA_IMAGES && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-brand-blue hover:text-brand-blue cursor-pointer text-[12px] gap-1">
                  <Plus className="w-5 h-5" /> Agregar fotos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []).slice(0, MAX_MEDIA_IMAGES - images.length);
                      e.target.value = '';
                      const added: MediaImage[] = [];
                      for (const f of files) added.push({ url: await shrink(f).catch(() => ''), caption: '' });
                      setImages((cur) => [...cur, ...added.filter((a) => a.url)]);
                    }}
                  />
                </label>
              )}
            </div>
            <button onClick={savePhotos} disabled={busy !== null} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
              {busy === 'photos' && <Loader2 className="w-4 h-4 animate-spin" />} Guardar fotos
            </button>
          </div>

          {/* voice note */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-[13px] font-semibold text-slate-900">🎤 Nota de voz</p>
            <p className="text-[11.5px] text-slate-500">Grábala aquí o sube un audio (mp3, m4a, ogg; hasta 3 minutos). Konnexa la convierte en nota de voz de WhatsApp y la transcribe.</p>
            {busy === 'audio' && (
              <p className="text-[12.5px] text-slate-600 inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Convirtiendo a nota de voz y transcribiendo…
              </p>
            )}
            {audio && busy !== 'audio' && (
              <div className="rounded-xl bg-slate-50 p-3 space-y-2">
                <audio controls src={audio.url} className="w-full h-10" preload="none" />
                <label className="block text-[12px] text-slate-600">
                  Lo que dice (el asistente responde con esto; corrígelo si algo quedó mal)
                  <textarea className="mt-1 w-full text-[12.5px] border border-slate-200 rounded-lg px-2.5 py-2 bg-white" rows={4} maxLength={4000} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={saveTranscript} disabled={busy !== null} className="h-8 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                    {busy === 'text' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar texto
                  </button>
                  <button onClick={removeAudio} disabled={busy !== null} className="h-8 px-3 rounded-lg text-[12px] font-semibold text-slate-500 hover:text-red-600 inline-flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Quitar
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {rec ? (
                <button onClick={() => rec.r.stop()} className="h-9 px-3 rounded-lg bg-red-600 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5">
                  <Square className="w-3.5 h-3.5" /> Detener ({secs(tick)})
                </button>
              ) : (
                <button onClick={record} disabled={busy !== null} className="h-9 px-3 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50">
                  <Mic className="w-3.5 h-3.5" /> {audio ? 'Grabar otra' : 'Grabar aquí'}
                </button>
              )}
              <label className={`h-9 px-3 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer ${busy || rec ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload className="w-3.5 h-3.5" /> {audio ? 'Subir otra' : 'Subir audio'}
                <input
                  type="file"
                  accept="audio/*,.ogg,.opus,.mp3,.m4a"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) sendAudio(f.type ? f : new Blob([f], { type: 'audio/ogg' }));
                  }}
                />
              </label>
            </div>
          </div>
          {err && <p className="text-[12.5px] text-red-600">{err}</p>}
          {saved && <p className="text-[12.5px] text-emerald-700">{saved}</p>}
        </div>
      </div>
    </div>
  );
}
