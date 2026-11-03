'use client';

// "Perfil de WhatsApp": photo, info, description, address, email, websites and category of the store's number,
// with a preview of what the customer sees.
import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronDown, ExternalLink, Loader2, Store } from 'lucide-react';
import { PROFILE_LIMITS, WA_VERTICALS, type WaProfile } from '@/lib/wa-profile';

interface Info {
  profile: WaProfile;
  name: string | null;
  nameStatus: string | null;
  phone: string | null;
  wabaId: string | null;
}

const input = 'w-full h-10 text-[13px] border border-slate-200 rounded-lg px-3 bg-white';
const label = 'text-xs font-medium text-slate-600';

async function call(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: 'no-store', ...init, headers: { 'content-type': 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

// Square JPEG of 640 px (what WhatsApp shows best), cut from the center.
function squareJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 640;
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 640, 640);
      g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 640, 640);
      resolve(c.toDataURL('image/jpeg', 0.9));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = URL.createObjectURL(file);
  });
}

const NAME_STATUS: Record<string, string> = {
  APPROVED: 'Aprobado',
  AVAILABLE_WITHOUT_REVIEW: 'Aprobado',
  PENDING_REVIEW: 'En revisión de Meta',
  DECLINED: 'Rechazado por Meta',
  EXPIRED: 'Vencido',
  NONE: 'Sin revisar',
};

export default function WhatsAppProfile() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [form, setForm] = useState<WaProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || info) return;
    call('/api/whatsapp/profile')
      .then((d: Info) => {
        setInfo(d);
        setForm(d.profile);
      })
      .catch((e) => setError(e.message));
  }, [open, info]);

  const set = (p: Partial<WaProfile>) => setForm((f) => (f ? { ...f, ...p } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setMsg(null);
    try {
      const d: Info = await call('/api/whatsapp/profile', { method: 'PUT', body: JSON.stringify(form) });
      setInfo(d);
      setForm(d.profile);
      setMsg({ ok: true, text: 'Perfil actualizado en WhatsApp. Los clientes lo ven en unos minutos.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setMsg(null);
    try {
      const image = await squareJpeg(file);
      setPreview(image);
      const d: Info = await call('/api/whatsapp/profile', { method: 'POST', body: JSON.stringify({ image }) });
      setInfo(d);
      setForm((f) => (f ? { ...f, profilePictureUrl: d.profile.profilePictureUrl } : d.profile));
      setMsg({ ok: true, text: 'Foto de perfil actualizada en WhatsApp.' });
    } catch (e: any) {
      setPreview(null);
      setMsg({ ok: false, text: e.message });
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const photo = preview || form?.profilePictureUrl || null;
  const managerUrl = info?.wabaId ? `https://business.facebook.com/wa/manage/phone-numbers/?waba_id=${info.wabaId}` : 'https://business.facebook.com/wa/manage/home/';

  return (
    <div className="rounded-xl border border-slate-200">
      <button onClick={() => setOpen((v) => !v)} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 rounded-xl">
        <span>
          <span className="block text-[13px] font-semibold text-slate-900">Perfil de WhatsApp</span>
          <span className="block text-[11px] text-slate-500">Foto, descripción, dirección, correo y sitio web que ven tus clientes.</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {error && <p className="text-[13px] text-red-600">No se pudo leer el perfil: {error}</p>}
          {!form && !error && <div className="h-40 rounded-xl bg-slate-50 animate-pulse" />}
          {form && info && (
            <div className="grid lg:grid-cols-[1fr_260px] gap-5">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={photoBusy}
                    className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 group"
                    aria-label="Cambiar foto de perfil"
                  >
                    {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <Store className="w-8 h-8 text-slate-300 m-auto" />}
                    <span className="absolute inset-0 bg-slate-900/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      {photoBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    </span>
                    {photoBusy && (
                      <span className="absolute inset-0 bg-slate-900/40 text-white flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </span>
                    )}
                  </button>
                  <div className="min-w-0">
                    <button onClick={() => fileRef.current?.click()} disabled={photoBusy} className="text-[13px] font-semibold text-brand-blue">
                      Cambiar foto
                    </button>
                    <p className="text-[11px] text-slate-500">JPG o PNG. Konnexa la recorta cuadrada (640×640). Se cambia apenas la eliges.</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[12px] text-slate-700">
                  <span className="font-semibold">Nombre que se muestra:</span> {info.name || '—'}
                  {info.nameStatus && <span className="text-slate-500"> · {NAME_STATUS[info.nameStatus] || info.nameStatus}</span>}
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    El nombre lo aprueba Meta.{' '}
                    <a href={managerUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-blue inline-flex items-center gap-0.5">
                      Pedir cambio en el Administrador de WhatsApp <ExternalLink className="w-3 h-3" />
                    </a>
                  </span>
                </div>

                <label className="block">
                  <span className={label}>
                    Info (la frase bajo el nombre) · {form.about.length}/{PROFILE_LIMITS.about}
                  </span>
                  <input value={form.about} maxLength={PROFILE_LIMITS.about} onChange={(e) => set({ about: e.target.value })} className={`mt-1 ${input}`} placeholder="Envíos a toda Colombia · Pagas al recibir 🚚" />
                </label>
                <label className="block">
                  <span className={label}>
                    Descripción del negocio · {form.description.length}/{PROFILE_LIMITS.description}
                  </span>
                  <textarea
                    value={form.description}
                    maxLength={PROFILE_LIMITS.description}
                    rows={3}
                    onChange={(e) => set({ description: e.target.value })}
                    className="mt-1 w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2 bg-white"
                    placeholder="Qué vendes, cómo compran y en cuánto llega."
                  />
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className={label}>Categoría</span>
                    <select value={form.vertical} onChange={(e) => set({ vertical: e.target.value })} className={`mt-1 ${input}`}>
                      {WA_VERTICALS.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={label}>Correo</span>
                    <input value={form.email} type="email" maxLength={PROFILE_LIMITS.email} onChange={(e) => set({ email: e.target.value })} className={`mt-1 ${input}`} />
                  </label>
                </div>
                <label className="block">
                  <span className={label}>Dirección</span>
                  <input value={form.address} maxLength={PROFILE_LIMITS.address} onChange={(e) => set({ address: e.target.value })} className={`mt-1 ${input}`} placeholder="Ciudad o dirección de la tienda" />
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[0, 1].map((i) => (
                    <label key={i} className="block">
                      <span className={label}>Sitio web {i + 1}</span>
                      <input
                        value={form.websites[i] || ''}
                        maxLength={PROFILE_LIMITS.website}
                        onChange={(e) => {
                          const w = [form.websites[0] || '', form.websites[1] || ''];
                          w[i] = e.target.value;
                          set({ websites: w });
                        }}
                        className={`mt-1 ${input}`}
                        placeholder={i === 0 ? 'https://tutienda.com' : 'https://instagram.com/tutienda'}
                      />
                    </label>
                  ))}
                </div>
                {msg && (
                  <p className={`text-[13px] flex items-start gap-1.5 ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                    {msg.ok && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                    {msg.text}
                  </p>
                )}
                <div className="flex justify-end">
                  <button onClick={save} disabled={saving} className="h-10 px-5 rounded-xl bg-brand-gradient text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar en WhatsApp
                  </button>
                </div>
              </div>

              {/* What the customer sees */}
              <div className="rounded-2xl bg-[#f0f2f5] border border-slate-200 p-4 text-center self-start">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-3">Así lo ve el cliente</p>
                <div className="w-24 h-24 rounded-full overflow-hidden bg-white border border-slate-200 mx-auto">
                  {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <Store className="w-10 h-10 text-slate-300 m-auto mt-6" />}
                </div>
                <p className="mt-2 text-[15px] font-semibold text-slate-900">{info.name || 'Tu tienda'}</p>
                <p className="text-[12px] text-slate-500">{info.phone || ''}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Cuenta de empresa</p>
                <div className="mt-3 bg-white rounded-xl p-3 text-left space-y-1.5 text-[12px] text-slate-700">
                  {form.about && <p>{form.about}</p>}
                  {form.description && <p className="text-slate-500 whitespace-pre-wrap">{form.description}</p>}
                  {form.vertical !== 'UNDEFINED' && <p className="text-slate-500">🏷️ {WA_VERTICALS.find((v) => v.id === form.vertical)?.label}</p>}
                  {form.address && <p className="text-slate-500">📍 {form.address}</p>}
                  {form.email && <p className="text-slate-500">✉️ {form.email}</p>}
                  {form.websites.filter(Boolean).map((w) => (
                    <p key={w} className="text-[#027eb5] truncate">
                      🔗 {w}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
