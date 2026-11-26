'use client';

// Integraciones → Shopify (carritos abandonados): how to add the webhook in Shopify, the signing key, the wait
// before writing, and the latest carts with what happened to each one.
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Loader2, Send, ShoppingCart } from 'lucide-react';

interface Cart {
  token: string;
  name: string;
  phone: string;
  items: { title: string; qty: number; price: number }[];
  total: number;
  currency: string;
  city: string;
  status: 'waiting' | 'old' | 'sent' | 'recovered' | 'declined' | 'purchased' | 'skipped' | 'failed';
  note?: string;
  createdAt?: string;
  updatedAt: string;
  sentAt?: string;
  orderNumber?: string;
}
interface Info {
  settings: { enabled: boolean; delayMinutes: number; hasSecret: boolean; shop: string | null; hasAdmin: boolean };
  webhookUrl: string;
  carts: Cart[];
}

async function call<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json' } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

const STATUS: Record<Cart['status'], { label: string; cls: string }> = {
  waiting: { label: 'Esperando', cls: 'bg-slate-100 text-slate-700' },
  old: { label: 'Anterior', cls: 'bg-violet-50 text-violet-700' },
  sent: { label: 'Mensaje enviado', cls: 'bg-sky-50 text-sky-700' },
  recovered: { label: 'Recuperado', cls: 'bg-emerald-50 text-emerald-700' },
  purchased: { label: 'Compró en Shopify', cls: 'bg-emerald-50 text-emerald-700' },
  declined: { label: 'Dijo que no', cls: 'bg-slate-100 text-slate-500' },
  skipped: { label: 'No se envió', cls: 'bg-slate-100 text-slate-500' },
  failed: { label: 'Error', cls: 'bg-red-50 text-red-700' },
};
const DELAYS = [
  [15, '15 minutos'],
  [30, '30 minutos'],
  [60, '1 hora'],
  [120, '2 horas'],
  [240, '4 horas'],
  [720, '12 horas'],
] as const;
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function ShopifyCarts() {
  const [info, setInfo] = useState<Info | null>(null);
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shop, setShop] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [days, setDays] = useState(7);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      setInfo(await call<Info>('/api/shopify'));
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (patch: Record<string, unknown>) => {
    setBusy('save');
    setError(null);
    setSaved(false);
    try {
      await call('/api/shopify', { method: 'PUT', body: JSON.stringify(patch) });
      setSecret('');
      setSaved(true);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const sendNow = async (token: string) => {
    setBusy(token);
    setError(null);
    try {
      await call('/api/shopify', { method: 'POST', body: JSON.stringify({ token }) });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const connectAdmin = async () => {
    setBusy('admin');
    setError(null);
    try {
      await call('/api/shopify', { method: 'PUT', body: JSON.stringify({ shop, clientId, clientSecret }) });
      setClientId('');
      setClientSecret('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const importOld = async () => {
    setBusy('import');
    setError(null);
    setNotice(null);
    try {
      const d = await call<{ imported: { found: number; added: number; noPhone: number; bought: number; hasOrder: number; already: number; hidden?: boolean } }>('/api/shopify', { method: 'POST', body: JSON.stringify({ importDays: days }) });
      const r = d.imported;
      const protectedHint =
        ' Si en Shopify sí ves pedidos abandonados (o salen «sin celular»), falta permitir los datos de los clientes: Shopify Dev Dashboard → tu app → Configuración → Solicitudes de acceso → Datos protegidos del cliente → Administrar → marca Datos del cliente, Nombre, Correo, Teléfono y Dirección → Guardar. Luego trae de nuevo.';
      setNotice(
        `Shopify entregó ${r.found} carritos abandonados. ${r.added} ${r.added === 1 ? 'quedó listo' : 'quedaron listos'} para enviar.` +
          [r.bought && `${r.bought} ya compraron`, r.hasOrder && `${r.hasOrder} ya tienen pedido en Konnexa`, r.noPhone && `${r.noPhone} sin celular`, r.already && `${r.already} ya estaban`].filter(Boolean).map((x) => ` ${x}.`).join('') +
          (r.found === 0 || r.hidden || (r.noPhone > 0 && r.noPhone >= r.found / 2) ? protectedHint : ''),
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const sendPicked = async () => {
    const tokens = Array.from(picked);
    if (!tokens.length || !confirm(`¿Enviar la plantilla «Recuperar carrito» a ${tokens.length} ${tokens.length === 1 ? 'cliente' : 'clientes'}? Meta cobra cada mensaje como marketing.`)) return;
    setBusy('batch');
    setError(null);
    setNotice(null);
    try {
      const d = await call<{ sent: number; failed: number; error?: string }>('/api/shopify', { method: 'POST', body: JSON.stringify({ tokens }) });
      setNotice(`${d.sent} ${d.sent === 1 ? 'mensaje enviado' : 'mensajes enviados'}.${d.failed ? ` ${d.failed} no salieron: ${d.error || 'error de WhatsApp'}` : ''}`);
      setPicked(new Set());
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!info) return <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">{error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}</div>;
  const s = info.settings;
  const recovered = info.carts.filter((c) => c.status === 'recovered').length;
  const sent = info.carts.filter((c) => ['sent', 'recovered', 'declined'].includes(c.status)).length;
  const old = info.carts.filter((c) => c.status === 'old');
  const allPicked = old.length > 0 && old.every((c) => picked.has(c.token));
  const togglePick = (t: string) => setPicked((p) => {
    const n = new Set(p);
    n.has(t) ? n.delete(t) : n.add(t);
    return n;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#5E8E3E]" /> Shopify · carritos abandonados
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Cuando alguien deja su celular en el pago de Shopify y no compra, Konnexa le escribe por WhatsApp con los botones <b>Confirmar pedido</b> / <b>No, gracias</b>. Si confirma, el pedido
            queda en Pedidos (contraentrega).
          </p>
        </div>
        <span className={`shrink-0 text-[12px] font-semibold rounded-full px-2 py-0.5 ${s.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{s.enabled ? 'Activo' : 'Apagado'}</span>
      </div>

      <ol className="text-[13px] text-slate-700 space-y-2 list-decimal pl-5">
        <li>
          En Shopify: <b>Configuración → Notificaciones → Webhooks → Crear webhook</b>. Formato <b>JSON</b>, la versión más reciente y esta URL:
          <button
            type="button"
            onClick={() => (navigator.clipboard.writeText(info.webhookUrl).catch(() => {}), setCopied(true), setTimeout(() => setCopied(false), 1500))}
            className="mt-1 flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left font-mono text-[12px] break-all hover:bg-slate-100"
          >
            <span className="flex-1">{info.webhookUrl}</span>
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>
          Crea tres, todos con la misma URL: <b>Creación de pago</b> (Checkout creation), <b>Actualización de pago</b> (Checkout update) y <b>Creación de pedido</b> (Order creation).
        </li>
        <li>
          Debajo de la lista de webhooks Shopify dice «Tus webhooks se firmarán con …». Copia esa clave y pégala aquí:
          <div className="mt-1 flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={s.hasSecret ? 'Clave guardada ✓ (pega otra para cambiarla)' : 'Clave de firma de los webhooks'}
              className="flex-1 h-9 rounded-lg border border-slate-200 px-2.5 text-[13px]"
            />
            <button type="button" disabled={!secret.trim() || busy !== null} onClick={() => save({ secret })} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-40">
              Guardar clave
            </button>
          </div>
        </li>
        <li>
          En <b>Plantillas → Nueva plantilla</b>, crea <b>«Recuperar carrito (Shopify)»</b> y espera a que Meta la apruebe.
        </li>
        <li className="space-y-2">
          <span>Elige cuánto esperar y actívalo:</span>
          <div className="flex flex-wrap items-center gap-2">
            <select value={s.delayMinutes} onChange={(e) => save({ delayMinutes: Number(e.target.value) })} disabled={busy !== null} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px]">
              {DELAYS.map(([v, l]) => (
                <option key={v} value={v}>
                  Escribir {l} después
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => save({ enabled: !s.enabled })}
              className={`h-9 px-3 rounded-lg text-[13px] font-semibold ${s.enabled ? 'bg-white border border-slate-200 text-slate-700' : 'bg-[#5E8E3E] text-white'}`}
            >
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : s.enabled ? 'Apagar' : 'Activar'}
            </button>
            {saved && <span className="text-[12px] text-emerald-700">Guardado</span>}
          </div>
        </li>
      </ol>
      <p className="text-[12px] text-slate-500">
        No se escribe a quien ya compró en Shopify, a quien ya tiene un pedido en Konnexa, ni a carritos de más de 48 horas. Cada carrito recibe un solo mensaje.
      </p>
      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
        <div>
          <p className="text-[14px] font-semibold text-slate-900">Carritos de antes</p>
          <p className="text-[12.5px] text-slate-600">
            Los webhooks solo traen los carritos nuevos. Para los que ya estaban en Shopify (Pedidos → Pedidos abandonados), conecta una app de Shopify y tráelos. Konnexa quita a quien ya
            compró, a quien ya tiene pedido aquí y a los que no tienen celular; luego tú eliges a quién escribir.
          </p>
        </div>
        {!info.settings.hasAdmin ? (
          <>
            <ol className="text-[12.5px] text-slate-700 space-y-1 list-decimal pl-5">
              <li>
                En Shopify: <b>Configuración → Apps → Desarrollar apps</b> (se abre <b>Shopify Dev Dashboard</b>) → <b>Crear app</b>. Ponle de nombre Konnexa y como URL de la app{' '}
                <span className="font-mono">https://konnexa.lat</span>; quita «Incrustar app en el panel de control».
              </li>
              <li>
                En <b>Alcances</b> escribe <span className="font-mono">read_orders</span> y crea / publica la versión.
              </li>
              <li>
                <b>Instala la app en tu tienda</b> y abre su <b>Configuración</b>: copia el <b>ID de cliente</b> y el <b>secreto</b> y pégalos aquí con el dominio de tu tienda.
              </li>
            </ol>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="mitienda.myshopify.com" autoCapitalize="none" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] sm:col-span-2" />
              <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="ID de cliente (Client ID)" autoCapitalize="none" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]" />
              <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Secreto (Client secret)" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]" />
              <button type="button" disabled={!shop.trim() || !clientSecret.trim() || busy !== null} onClick={connectAdmin} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[13px] font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-1.5 sm:col-span-2">
                {busy === 'admin' && <Loader2 className="w-4 h-4 animate-spin" />} Conectar
              </button>
            </div>
            <p className="text-[11px] text-slate-500">¿Tu app es de las antiguas y te dio un token que empieza por shpat_? Pégalo en el campo del secreto y deja el ID vacío.</p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-slate-600">
              Conectado a <b>{info.settings.shop}</b> ·
            </span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px]">
              {[3, 7, 15, 30].map((d) => (
                <option key={d} value={d}>
                  Últimos {d} días
                </option>
              ))}
            </select>
            <button type="button" disabled={busy !== null} onClick={importOld} className="h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40">
              {busy === 'import' && <Loader2 className="w-4 h-4 animate-spin" />} Traer carritos
            </button>
            <button type="button" disabled={busy !== null} onClick={() => call('/api/shopify', { method: 'PUT', body: JSON.stringify({ disconnectAdmin: true }) }).then(load)} className="h-9 px-2 text-[12px] text-slate-500 hover:text-red-600">
              Desconectar
            </button>
          </div>
        )}
        {old.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-[13px] text-slate-700">
                <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(old.map((c) => c.token)))} className="w-4 h-4" />
                {old.length} {old.length === 1 ? 'carrito anterior' : 'carritos anteriores'} · seleccionar todos
              </label>
              <button type="button" disabled={!picked.size || busy !== null} onClick={sendPicked} className="ml-auto h-9 px-3 rounded-lg bg-[#5E8E3E] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40">
                {busy === 'batch' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar a {picked.size || ''} {picked.size === 1 ? 'seleccionado' : 'seleccionados'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Máximo 50 por envío. Empieza por los más recientes: son los que más se recuperan.</p>
          </div>
        )}
      </div>
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-slate-900">Últimos carritos</span>
          {sent > 0 && (
            <span className="text-[12px] text-slate-500">
              {recovered} recuperados de {sent} mensajes
            </span>
          )}
        </div>
        {!info.carts.length ? (
          <p className="text-[13px] text-slate-500">Todavía no llega ninguno. Aparecen aquí cuando Shopify avisa de un pago sin terminar.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {info.carts.map((c) => (
              <div key={c.token} className="p-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                {c.status === 'old' && <input type="checkbox" aria-label={`Elegir ${c.name || c.phone}`} checked={picked.has(c.token)} onChange={() => togglePick(c.token)} className="w-4 h-4" />}
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium text-slate-900">
                    {c.name || 'Sin nombre'} <span className="text-slate-400 font-normal">· +{c.phone}</span>
                  </p>
                  <p className="text-slate-600 truncate">
                    {c.items.map((i) => (i.qty > 1 ? `${i.qty} x ${i.title}` : i.title)).join(', ')} · ${c.total.toLocaleString('es-CO')}
                    {c.city ? ` · ${c.city}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {c.status === 'old' ? `Abandonado el ${when(c.createdAt || c.updatedAt)}` : when(c.updatedAt)}
                    {c.note ? ` · ${c.note}` : ''}
                    {c.orderNumber ? ` · Pedido ${c.orderNumber}` : ''}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
                {(c.status === 'waiting' || c.status === 'failed' || c.status === 'old') && (
                  <button type="button" disabled={busy !== null} onClick={() => sendNow(c.token)} className="h-8 px-2.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1">
                    {busy === c.token ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar ahora
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
