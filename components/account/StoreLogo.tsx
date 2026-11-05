'use client';

// Configuración → the store's logo (shown in the menu, the store switcher and "Mis tiendas").
import React, { useEffect, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { fetchAccount } from '@/lib/account-client';
import StoreAvatar, { STORE_LOGO_EVENT } from '@/components/layout/StoreAvatar';

// Square, at most 512 px. PNG keeps transparency; anything else becomes JPG.
function prepare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return reject(new Error('Usa una imagen JPG, PNG o WEBP.'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const out = Math.min(512, side);
      const c = document.createElement('canvas');
      c.width = c.height = out;
      const g = c.getContext('2d')!;
      if (!/png/i.test(file.type)) {
        g.fillStyle = '#fff';
        g.fillRect(0, 0, out, out);
      }
      g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out);
      URL.revokeObjectURL(url);
      resolve(/png/i.test(file.type) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('No pudimos leer esa imagen.'));
    img.src = url;
  });
}

export default function StoreLogo() {
  const [org, setOrg] = useState<{ id: string; name: string; role: string; logo?: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetchAccount().then((r: any) => r.data?.org && setOrg(r.data.org));
  }, []);
  if (!org) return null;
  const can = org.role === 'owner' || org.role === 'admin';

  const send = async (method: 'POST' | 'DELETE', image?: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/account/logo', { method, headers: { 'Content-Type': 'application/json' }, body: image ? JSON.stringify({ image }) : undefined });
      const d = await res.json().catch(() => ({}));
      if (!d.success) throw new Error(d.error || `HTTP ${res.status}`);
      setOrg((o) => (o ? { ...o, logo: method === 'POST' ? d.url : null } : o));
      window.dispatchEvent(new Event(STORE_LOGO_EVENT));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <StoreAvatar name={org.name} logo={org.logo} id={org.id} className="w-16 h-16 rounded-2xl text-2xl" />
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-600">Logo de la tienda</p>
        <p className="text-[11px] text-slate-500">Aparece en el menú, al cambiar de tienda y en “Mis tiendas”, para distinguirlas. Cuadrado, JPG o PNG.</p>
        {can ? (
          <div className="flex items-center gap-2">
            <label className={`h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {org.logo ? 'Cambiar logo' : 'Subir logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    await send('POST', await prepare(f));
                  } catch (x: any) {
                    setErr(x.message);
                  }
                }}
              />
            </label>
            {org.logo && (
              <button type="button" onClick={() => send('DELETE')} disabled={busy} className="h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 inline-flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Quitar
              </button>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">Solo el dueño o un administrador pueden cambiarlo.</p>
        )}
        {err && <p className="text-[11px] text-red-600">{err}</p>}
      </div>
    </div>
  );
}
