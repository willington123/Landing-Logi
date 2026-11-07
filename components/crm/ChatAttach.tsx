'use client';

// Mensajes → 📎 photo, video or document, and 🎤 voice note, as in WhatsApp. The file goes straight from the browser
// to storage (big videos never pass through our server), then Konnexa sends it to the customer.
import React, { useEffect, useRef, useState } from 'react';
import { chatOrgHeaders } from '@/lib/inbox-stores';
import { FileText, Loader2, Mic, Paperclip, Send, Square, Trash2, X } from 'lucide-react';

type Kind = 'image' | 'video' | 'audio' | 'document';
interface Pending {
  file: Blob;
  kind: Kind;
  name: string;
  preview: string | null; // object URL for photos, videos and voice notes
  voice?: boolean; // recorded here
  seconds?: number;
}

const kindOf = (t: string): Kind => (t.startsWith('image/') ? 'image' : t.startsWith('video/') ? 'video' : t.startsWith('audio/') ? 'audio' : 'document');
const mmss = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;

// Photos over 1600 px or not JPG/PNG become a JPG (WhatsApp takes up to 5 MB).
function photoForWhatsApp(file: File): Promise<Blob> {
  if (/^image\/(jpeg|png)$/.test(file.type) && file.size < 4.5 * 1024 * 1024) return Promise.resolve(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('No pudimos preparar la foto.'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('No pudimos leer esa imagen.'));
    img.src = url;
  });
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...chatOrgHeaders() }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

export default function ChatAttach({ chatId, onSent, onError }: { chatId: string; onSent: () => void; onError: (msg: string | null) => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<{ r: MediaRecorder; start: number } | null>(null);
  const [tick, setTick] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setTick((Date.now() - rec.start) / 1000), 250);
    return () => clearInterval(t);
  }, [rec]);
  useEffect(() => () => void (pending?.preview && URL.revokeObjectURL(pending.preview)), [pending]);
  useEffect(() => {
    setPending(null);
    setCaption('');
  }, [chatId]);

  const pick = async (f: File) => {
    onError(null);
    const kind = kindOf(f.type || '');
    try {
      const file = kind === 'image' ? await photoForWhatsApp(f) : f;
      setPending({ file, kind, name: f.name || 'archivo', preview: kind === 'document' ? null : URL.createObjectURL(file) });
      setCaption('');
    } catch (e: any) {
      onError(e.message);
    }
  };

  const record = async () => {
    onError(null);
    try {
      // No call filters: they make a recorded voice sound strange.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false, channelCount: 1 } });
      const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 128000 });
      chunks.current = [];
      const start = Date.now();
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const blob = new Blob(chunks.current, { type: (r.mimeType || 'audio/webm').split(';')[0] });
        if (blob.size) setPending({ file: blob, kind: 'audio', name: 'nota-de-voz', preview: URL.createObjectURL(blob), voice: true, seconds: (Date.now() - start) / 1000 });
      };
      r.start();
      setTick(0);
      setRec({ r, start });
    } catch {
      onError('No pudimos usar el micrófono. Revisa el permiso del navegador.');
    }
  };

  const send = async () => {
    if (!pending) return;
    setBusy(true);
    onError(null);
    try {
      const mime = (pending.file.type || 'application/octet-stream').split(';')[0];
      const up = await post(`/api/whatsapp/conversations/${chatId}/upload`, { kind: pending.kind, mime, size: pending.file.size, name: pending.name });
      const put = await fetch(up.uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: pending.file });
      if (!put.ok) throw new Error(`No se pudo subir el archivo (HTTP ${put.status}).`);
      await post(`/api/whatsapp/conversations/${chatId}/media`, { path: up.path, kind: pending.kind, caption: caption.trim(), filename: pending.kind === 'document' ? pending.name : '' });
      setPending(null);
      setCaption('');
      onSent();
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {pending && (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-10 rounded-2xl border border-slate-200 bg-white shadow-lg p-3 space-y-2">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {pending.kind === 'image' && pending.preview && <img src={pending.preview} alt="" className="max-h-48 rounded-xl" />}
              {pending.kind === 'video' && pending.preview && <video src={pending.preview} controls className="max-h-48 rounded-xl" />}
              {pending.kind === 'audio' && pending.preview && (
                <div className="space-y-1">
                  <p className="text-[12px] text-slate-600">🎤 {pending.voice ? `Nota de voz ${mmss(pending.seconds || 0)}` : pending.name} · le llega como nota de voz</p>
                  <audio src={pending.preview} controls className="w-full h-10" />
                </div>
              )}
              {pending.kind === 'document' && (
                <p className="flex items-center gap-2 text-[13px] text-slate-800">
                  <FileText className="w-5 h-5 text-slate-500" /> {pending.name}
                </p>
              )}
            </div>
            <button onClick={() => setPending(null)} disabled={busy} className="p-1 text-slate-400 hover:text-red-600" aria-label="Descartar">
              {pending.voice ? <Trash2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            {pending.kind !== 'audio' && (
              <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={1024} placeholder="Agrega un mensaje (opcional)" className="flex-1 text-[13px] bg-slate-50 border border-slate-200 rounded-xl px-3 h-9 focus:outline-none" />
            )}
            <button onClick={send} disabled={busy} className="h-9 px-3 rounded-xl bg-[#25D366] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 ml-auto">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/3gpp,video/quicktime,audio/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) pick(f);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy || Boolean(rec)}
        className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
        aria-label="Adjuntar foto, video o documento"
        title="Foto, video o documento"
      >
        <Paperclip className="w-4 h-4" />
      </button>
      {rec ? (
        <button type="button" onClick={() => rec.r.stop()} className="h-9 px-2.5 shrink-0 rounded-xl bg-red-600 text-white text-[12px] font-semibold inline-flex items-center gap-1" aria-label="Detener grabación">
          <Square className="w-3.5 h-3.5" /> {mmss(tick)}
        </button>
      ) : (
        <button
          type="button"
          onClick={record}
          disabled={busy || Boolean(pending)}
          className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
          aria-label="Grabar nota de voz"
          title="Grabar nota de voz"
        >
          <Mic className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
