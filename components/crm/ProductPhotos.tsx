'use client';

// Mensajes → 🖼 the products' named photos (Precios, Producto, Tallas…) and voice note, to send in one tap.
// The same material the AI assistant sends (Productos → Fotos y nota de voz).
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Images, Loader2, Mic, Send, X } from 'lucide-react';
import { crmApi } from '@/components/crm/CrmParts';
import { photoName, type ProductMedia } from '@/lib/product-media';

interface Item {
  id: string;
  name: string;
  media: ProductMedia;
}

export default function ProductPhotos({ chatId, onSent, onError }: { chatId: string; onSent: () => void; onError: (msg: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [productId, setProductId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [audio, setAudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    crmApi<{ products: Item[] }>('/api/products/media')
      .then((d) => {
        const list = d.products.filter((p) => p.media.images.length || p.media.audio);
        setItems(list);
        setProductId((cur) => (list.some((p) => p.id === cur) ? cur : list[0]?.id || ''));
      })
      .catch((e) => {
        setItems([]);
        onError(e.message);
      });
    const out = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', out);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', out);
      window.removeEventListener('keydown', esc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chatId]);

  // Another chat or product: start over.
  useEffect(() => {
    setPicked([]);
    setAudio(false);
  }, [productId, chatId]);
  useEffect(() => setOpen(false), [chatId]);

  const product = items?.find((p) => p.id === productId) || null;
  const toggle = (url: string) => setPicked((cur) => (cur.includes(url) ? cur.filter((u) => u !== url) : [...cur, url]));
  const count = picked.length + (audio ? 1 : 0);

  const send = async () => {
    if (!product || !count) return;
    setBusy(true);
    onError(null);
    try {
      const d = await crmApi<{ warning?: string }>(`/api/whatsapp/conversations/${chatId}/media`, { method: 'POST', body: JSON.stringify({ productId: product.id, urls: picked, audio }) });
      if (d.warning) onError(d.warning);
      setOpen(false);
      setPicked([]);
      setAudio(false);
      onSent();
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl border flex items-center justify-center transition ${open ? 'bg-sky-50 border-sky-200 text-sky-700' : 'border-slate-200 text-slate-500 hover:text-sky-700 hover:bg-sky-50'}`}
        aria-label="Fotos de los productos"
        title="Fotos de los productos (precios, producto, tallas…)"
      >
        <Images className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-30 w-[min(calc(100vw-1.5rem),380px)] bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col max-h-[65vh]">
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
            <p className="text-[13px] font-semibold text-slate-900">Fotos de los productos</p>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
          {!items ? (
            <div className="flex justify-center py-8 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !items.length ? (
            <p className="px-3 pb-4 text-[12.5px] text-slate-500">
              Aún no hay fotos. Súbelas y ponles nombre en{' '}
              <Link href="/productos" className="font-semibold text-brand-blue">
                Productos → Fotos y nota de voz
              </Link>
              .
            </p>
          ) : (
            <>
              {items.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
                  {items.map((p) => (
                    <button key={p.id} onClick={() => setProductId(p.id)} className={`h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap ${p.id === productId ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              {product && (
                <div className="px-3 pb-2 overflow-y-auto space-y-2">
                  {product.media.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {product.media.images.map((img) => {
                        const on = picked.includes(img.url);
                        return (
                          <button key={img.url} onClick={() => toggle(img.url)} className={`relative rounded-xl overflow-hidden border-2 text-left ${on ? 'border-brand-blue' : 'border-transparent'}`} title={img.caption || photoName(img)}>
                            <img src={img.url} alt={photoName(img)} className="w-full aspect-square object-cover bg-slate-100" />
                            <span className="absolute left-1 bottom-1 max-w-[calc(100%-0.5rem)] truncate rounded-md bg-white/95 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-800">{photoName(img)}</span>
                            {on && (
                              <span className="absolute right-1 top-1 w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center">
                                <Check className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {product.media.audio && (
                    <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] cursor-pointer ${audio ? 'border-brand-blue bg-sky-50/50' : 'border-slate-200'}`}>
                      <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} className="w-4 h-4 accent-brand-blue" />
                      <Mic className="w-4 h-4 text-slate-500" /> Nota de voz del producto
                      {product.media.audio.seconds ? <span className="text-slate-400">· {product.media.audio.seconds} s</span> : null}
                    </label>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5">
                <p className="text-[11.5px] text-slate-400">Van con su texto para el cliente, si lo tienen.</p>
                <button onClick={send} disabled={!count || busy} className="h-9 px-3 rounded-lg bg-brand-blue text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 shrink-0">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar{count ? ` (${count})` : ''}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
