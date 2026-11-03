'use client';

// Dropi: connect the store's token, choose whether confirmed orders go to Dropi on their own,
// and link each landing to the Dropi product that is shipped.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Image as ImageIcon, Link2, Loader2, Search, Truck, X } from 'lucide-react';

interface Link {
  productId: number;
  name: string;
  type: 'SIMPLE' | 'VARIABLE';
  supplierName: string | null;
  variationId: number | null;
  variationName: string | null;
  salePrice: number | null;
  image: string | null;
}
interface Info {
  canManage: boolean;
  connected: boolean;
  token: string | null;
  autoSend: boolean;
  landings: { id: string; name: string; image: string | null; link: Link | null }[];
}
interface Product {
  id: number;
  name: string;
  type: 'SIMPLE' | 'VARIABLE';
  salePrice: number | null;
  suggestedPrice: number | null;
  stock: number | null;
  image: string | null;
  supplierName: string | null;
  variations: { id: number; name: string; stock: number | null; salePrice: number | null }[];
}

async function call(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}
const cop = (n: number | null) => (n === null ? '—' : `$${Math.round(n).toLocaleString('es-CO')}`);
const input = 'w-full h-10 text-[13px] bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-brand-navy/40 focus:ring-2 focus:ring-brand-navy/10';
const primary = 'h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50';

function Thumb({ src, size = 'w-10 h-10' }: { src: string | null; size?: string }) {
  const [bad, setBad] = useState(false);
  return (
    <div className={`${size} rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center`}>
      {src && !bad ? <img src={src} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : <ImageIcon className="w-4 h-4 text-slate-300" />}
    </div>
  );
}

export default function DropiConnection() {
  const [info, setInfo] = useState<Info | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [picking, setPicking] = useState<{ id: string; name: string } | null>(null);
  const [replace, setReplace] = useState(false);

  const load = useCallback(() => {
    call('/api/integrations/dropi')
      .then((d) => setInfo(d))
      .catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(load, [load]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await call('/api/integrations/dropi', 'PUT', { token });
      setToken('');
      setReplace(false);
      setMsg({ ok: true, text: 'Dropi conectado. Ahora vincula cada landing con su producto de Dropi.' });
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const setAuto = async (autoSend: boolean) => {
    setInfo((i) => (i ? { ...i, autoSend } : i));
    try {
      await call('/api/integrations/dropi', 'PUT', { autoSend });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
      load();
    }
  };
  const disconnect = async () => {
    if (!window.confirm('¿Desconectar Dropi? Los pedidos dejarán de enviarse. Los productos vinculados se guardan.')) return;
    await call('/api/integrations/dropi', 'DELETE').catch((e) => setMsg({ ok: false, text: e.message }));
    load();
  };
  const unlink = async (landingId: string) => {
    await call(`/api/dropi/links?landingId=${encodeURIComponent(landingId)}`, 'DELETE').catch((e) => setMsg({ ok: false, text: e.message }));
    load();
  };

  const linked = info?.landings.filter((l) => l.link).length || 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 md:col-span-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Dropi</h3>
            <p className="text-xs text-slate-500">Tus pedidos confirmados pasan a Dropi con pago contraentrega, sin copiarlos a mano.</p>
          </div>
        </div>
        {info?.connected ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Conectado
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            <AlertCircle className="w-3 h-3" /> Sin conectar
          </span>
        )}
      </div>

      {!info ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
      ) : (
        <>
          {info.connected && (
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="font-mono text-slate-500">{info.token}</span>
              {info.canManage && (
                <>
                  <button type="button" onClick={() => setReplace((x) => !x)} className="font-semibold text-brand-navy hover:underline">
                    Cambiar token
                  </button>
                  <button type="button" onClick={disconnect} className="font-semibold text-red-600 hover:underline">
                    Desconectar
                  </button>
                </>
              )}
            </div>
          )}

          {info.canManage && (!info.connected || replace) && (
            <div className="space-y-2">
              <ol className="list-decimal pl-5 text-[12.5px] text-slate-600 space-y-0.5">
                <li>
                  Entra a <b>Dropi</b> → menú <b>Mis Integraciones</b> → crea una tienda (ponle el nombre de tu tienda y guarda). Una sola tienda sirve para todos tus productos.
                </li>
                <li>Dropi te muestra un <b>token de integración</b>: cópialo y pégalo aquí.</li>
              </ol>
              <form onSubmit={connect} className="flex flex-col sm:flex-row gap-2">
                <input className={input} type="password" autoComplete="off" placeholder="Token de integración de Dropi" value={token} onChange={(e) => setToken(e.target.value)} />
                <button className={primary} disabled={busy || token.trim().length < 6}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Conectar
                </button>
              </form>
            </div>
          )}

          {msg && <p className={`text-[12.5px] ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}

          {info.connected && (
            <>
              <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-slate-900" checked={info.autoSend} disabled={!info.canManage} onChange={(e) => setAuto(e.target.checked)} />
                <span className="text-[13px]">
                  <b className="text-slate-900">Enviar a Dropi apenas el pedido se confirme</b>
                  <span className="block text-[12px] text-slate-500">
                    Cuando el cliente confirma por WhatsApp, por la llamada o lo marcas confirmado. Si lo apagas, envías cada pedido con el botón &quot;Enviar a Dropi&quot; en Pedidos.
                    Llega a Dropi como <b>pendiente de confirmación</b> y con recaudo.
                  </span>
                </span>
              </label>

              <div>
                <p className="text-[13px] font-semibold text-slate-900">
                  Productos <span className="font-normal text-slate-500">· {linked} de {info.landings.length} vinculados</span>
                </p>
                <p className="text-[12px] text-slate-500">Cada landing se despacha con el producto de Dropi que elijas. Las unidades del combo pasan como cantidad.</p>
                {!info.landings.length ? (
                  <p className="mt-2 text-[12.5px] text-slate-500">Aún no tienes landings.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {info.landings.map((l) => (
                      <li key={l.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Thumb src={l.image} />
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-slate-900 truncate">{l.name}</p>
                            {l.link ? (
                              <p className="text-[12px] text-emerald-700 truncate">
                                <Link2 className="inline w-3 h-3 mr-0.5" />
                                Dropi #{l.link.productId} · {l.link.name}
                                {l.link.variationName ? ` · ${l.link.variationName}` : ''}
                                {l.link.salePrice !== null && <span className="text-slate-500"> · proveedor {cop(l.link.salePrice)}</span>}
                              </p>
                            ) : (
                              <p className="text-[12px] text-amber-700">Sin vincular: sus pedidos no se pueden enviar a Dropi.</p>
                            )}
                          </div>
                        </div>
                        {info.canManage && (
                          <div className="flex gap-2 shrink-0">
                            <button type="button" onClick={() => setPicking({ id: l.id, name: l.name })} className="h-9 px-3 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">
                              {l.link ? 'Cambiar' : 'Vincular producto'}
                            </button>
                            {l.link && (
                              <button type="button" onClick={() => unlink(l.id)} className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-slate-500 hover:text-red-600">
                                Quitar
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </>
      )}
      {picking && (
        <ProductPicker
          landing={picking}
          onClose={() => setPicking(null)}
          onLinked={() => {
            setPicking(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductPicker({ landing, onClose, onLinked }: { landing: { id: string; name: string }; onClose: () => void; onLinked: () => void }) {
  const [q, setQ] = useState(landing.name);
  const [list, setList] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Product | null>(null);
  const [variation, setVariation] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const search = useCallback(async (term: string) => {
    setLoading(true);
    setErr(null);
    try {
      const d = await call(`/api/dropi/products?q=${encodeURIComponent(term)}`);
      setList(d.products);
    } catch (e: any) {
      setErr(e.message);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    search(landing.name);
  }, [landing.name, search]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const save = async () => {
    if (!chosen) return;
    setSaving(true);
    setErr(null);
    try {
      await call('/api/dropi/links', 'PUT', { landingId: landing.id, productId: chosen.id, variationId: variation });
      onLinked();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-[640px] max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900">Producto de Dropi</h3>
            <p className="text-xs text-slate-500 truncate">Para la landing: {landing.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          className="p-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setChosen(null);
            search(q);
          }}
        >
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del producto o su ID en Dropi" autoFocus />
          <button className={primary} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
          </button>
        </form>
        <div className="px-4 pb-4 overflow-y-auto flex-1 space-y-2">
          {err && <p className="text-[12.5px] text-red-600">{err}</p>}
          {list && !list.length && !err && <p className="text-[12.5px] text-slate-500 py-6 text-center">No encontramos productos con ese nombre. Prueba con otra palabra o con el ID del producto en Dropi.</p>}
          {(list || []).map((p) => {
            const on = chosen?.id === p.id;
            return (
              <div key={p.id} className={`rounded-xl border p-3 ${on ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setChosen(p);
                    setVariation(p.type === 'VARIABLE' && p.variations.length === 1 ? p.variations[0].id : null);
                  }}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <Thumb src={p.image} size="w-14 h-14" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{p.name}</p>
                    <p className="text-[11.5px] text-slate-500">
                      ID {p.id}
                      {p.supplierName ? ` · ${p.supplierName}` : ''}
                    </p>
                    <p className="text-[11.5px] text-slate-600">
                      Proveedor <b>{cop(p.salePrice)}</b> · sugerido {cop(p.suggestedPrice)}
                      {p.stock !== null && <> · stock {p.stock.toLocaleString('es-CO')}</>}
                      {p.type === 'VARIABLE' && ` · ${p.variations.length} variantes`}
                    </p>
                  </div>
                </button>
                {on && p.type === 'VARIABLE' && (
                  <label className="mt-3 block text-[12px] text-slate-600">
                    Variante que se despacha
                    <select className={`${input} mt-1`} value={variation ?? ''} onChange={(e) => setVariation(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Elige la variante…</option>
                      {p.variations.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                          {v.stock !== null ? ` · stock ${v.stock}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" onClick={save} className={primary} disabled={!chosen || saving || (chosen.type === 'VARIABLE' && !variation)}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Vincular
          </button>
        </div>
      </div>
    </div>
  );
}
