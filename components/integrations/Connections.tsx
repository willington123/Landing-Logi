'use client';

// Integrations: each store connects its own WhatsApp, Vapi, Meta Conversions API and Claude keys.
import React, { useEffect, useState } from 'react';
import { fetchAccount } from '@/lib/account-client';
import { AlertCircle, Check, CheckCircle2, Copy, ExternalLink, Loader2, Plug, Unplug } from 'lucide-react';

export interface IntegrationsInfo {
  canManage: boolean;
  embedded: { available: boolean; appId: string | null; configId: string | null; graphVersion: string };
  whatsapp: {
    connected: boolean;
    source?: 'env' | 'store';
    mode?: 'env' | 'manual' | 'embedded';
    phoneNumberId?: string;
    wabaId?: string | null;
    displayPhone?: string | null;
    confirmTemplate?: string | null;
    templateLang?: string;
    token?: string | null;
    appSecretSet?: boolean;
    webhookUrl: string;
    verifyToken?: string | null;
  };
  vapi: { connected: boolean; source?: 'env' | 'store'; phoneNumberId?: string; apiKey?: string | null };
  capi: { connected: boolean; source?: 'env' | 'store'; token?: string | null; testCode?: string | null };
  anthropic: { connected: boolean; source?: 'env' | 'store' | 'plan'; apiKey?: string | null; left?: number | null };
  metaAds: {
    connected: boolean;
    pending: boolean;
    accountId: string | null;
    accountName: string | null;
    accounts: { id: string; name: string | null; currency: string | null }[];
    currency: string | null;
    mode: 'oauth' | 'manual' | null;
    expiresAt: string | null;
    oauthAvailable: boolean;
  };
}

export async function loadIntegrations(): Promise<IntegrationsInfo | null> {
  const r = await fetch('/api/integrations', { cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) return null;
  const d = await r.json().catch(() => null);
  return d?.success ? d : null;
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

const input = 'w-full h-9 text-[13px] bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-brand-navy/40 focus:ring-2 focus:ring-brand-navy/10';
const primary = 'h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50';

function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500 mb-1">{label}</p>
      <div className="flex gap-1.5">
        <code className="flex-1 min-w-0 text-[11px] font-mono bg-slate-100 rounded-lg px-2.5 py-2 break-all text-slate-800">{value}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            } catch {
              window.prompt(label, value);
            }
          }}
          className="shrink-0 h-8 w-8 self-center rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
          aria-label={`Copiar ${label}`}
        >
          {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function SourceBadge({ source, left }: { source?: 'env' | 'store' | 'plan'; left?: number | null }) {
  if (!source) return null;
  if (source === 'plan')
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">
        Incluida en tu plan{typeof left === 'number' ? (left >= 100_000_000 ? ' · sin límite' : ` · ${left.toLocaleString('es-CO')} respuestas este mes`) : ''}
      </span>
    );
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${source === 'env' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
      {source === 'env' ? 'Claves de Vercel' : 'Conectado en el panel'}
    </span>
  );
}

function Disconnect({ kind, onDone, label = 'Desconectar' }: { kind: string; onDone: () => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm('¿Desconectar? La tienda dejará de usar esta conexión.')) return;
        setBusy(true);
        try {
          await call(`/api/integrations/${kind}`, 'DELETE');
          onDone();
        } catch (e: any) {
          alert(e.message);
        } finally {
          setBusy(false);
        }
      }}
      className="text-xs font-medium text-slate-400 hover:text-red-600 inline-flex items-center gap-1"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />} {label}
    </button>
  );
}

// ---------- Embedded Signup (Meta Tech Provider) ----------

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

function loadFacebookSdk(appId: string, version: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB);
    };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    s.defer = true;
    s.crossOrigin = 'anonymous';
    s.onerror = () => reject(new Error('No se pudo cargar Facebook. Revisa tu conexión o el bloqueador de anuncios.'));
    document.body.appendChild(s);
  });
}

function EmbeddedSignup({ info, onDone }: { info: IntegrationsInfo['embedded']; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    let session: { phoneNumberId?: string; wabaId?: string } = {};
    let fbError: string | null = null;
    const onMessage = (ev: MessageEvent) => {
      if (!/facebook\.com$/.test(new URL(ev.origin).hostname)) return;
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        const d = data.data || {};
        if (d.waba_id || d.phone_number_id) session = { phoneNumberId: d.phone_number_id || session.phoneNumberId, wabaId: d.waba_id || session.wabaId };
        if (data.event === 'ERROR' && d.error_message) fbError = `Facebook: ${d.error_message}`;
      } catch {
        // other messages from Facebook
      }
    };
    window.addEventListener('message', onMessage);
    try {
      const FB = await loadFacebookSdk(info.appId!, info.graphVersion);
      const code: string | null = await new Promise((resolve) =>
        FB.login((r: any) => resolve(r?.authResponse?.code || null), {
          config_id: info.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: '3' },
        }),
      );
      if (!code) throw new Error(fbError || 'Se canceló la conexión con Facebook.');
      // The session message (account and number) can arrive a bit after the login callback.
      for (let i = 0; i < 20 && !session.phoneNumberId; i++) await new Promise((r) => setTimeout(r, 250));
      // Without it, the server finds the account and number from what was shared in the popup.
      await call('/api/integrations/whatsapp/embedded', 'POST', { code, ...session });
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      window.removeEventListener('message', onMessage);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={start} disabled={busy} className="h-10 px-4 rounded-lg bg-[#1877F2] hover:bg-[#166fe0] text-white text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-60">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="font-black text-base leading-none">f</span>} Conectar con Facebook
      </button>
      <p className="text-[11px] text-slate-500">Eliges tu portafolio y tu número de WhatsApp en una ventana de Facebook. Sin copiar claves.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---------- WhatsApp ----------

export function WhatsAppConnection({ info, onChanged }: { info: IntegrationsInfo; onChanged: () => void }) {
  const wa = info.whatsapp;
  const [form, setForm] = useState({ token: '', phoneNumberId: '', wabaId: '', appSecret: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showManual, setShowManual] = useState(false);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const d = await call('/api/integrations/whatsapp', 'PUT', form);
      setForm({ token: '', phoneNumberId: '', wabaId: '', appSecret: '' });
      setMsg({ ok: true, text: `Conectado: ${d.displayPhone || 'número verificado'}${d.verifiedName ? ` (${d.verifiedName})` : ''}. Ahora pega el webhook en tu app de Meta.` });
      onChanged();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (wa.connected) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <p className="text-[13px] font-semibold text-slate-900">{wa.displayPhone ? `Conectado: ${wa.displayPhone}` : 'WhatsApp conectado'}</p>
          <SourceBadge source={wa.source} />
          {wa.mode === 'embedded' && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Con Facebook</span>}
        </div>
        <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
          <p>
            ID del número: <span className="font-mono">{wa.phoneNumberId}</span>
          </p>
          <p>
            Cuenta (WABA): <span className="font-mono">{wa.wabaId || '—'}</span>
          </p>
          {wa.token && (
            <p>
              Token: <span className="font-mono">{wa.token}</span>
            </p>
          )}
        </div>
        {wa.mode === 'manual' && (
          <div className="space-y-2 pt-2 border-t border-emerald-100">
            <p className="text-[11px] text-slate-600">
              En tu app de Meta → <strong>WhatsApp → Configuración → Webhook</strong>, pega estos dos datos y suscribe el campo <strong>messages</strong>. Es la misma
              URL para todos tus números: si esta app ya la tiene puesta, no cambies nada; cada mensaje llega a la tienda de su número.
            </p>
            <CopyField label="URL de devolución de llamada" value={wa.webhookUrl} />
            {wa.verifyToken && <CopyField label="Token de verificación" value={wa.verifyToken} />}
          </div>
        )}
        {info.canManage && wa.source === 'store' && <Disconnect kind="whatsapp" onDone={onChanged} />}
        {info.canManage && wa.source === 'env' && (
          <p className="text-[11px] text-slate-500">
            Esta tienda usa el número configurado en Vercel. Si conectas otro aquí, se usa el nuevo.{' '}
            <button type="button" className="font-semibold text-brand-navy hover:underline" onClick={() => setShowManual((v) => !v)}>
              Conectar otro número
            </button>
          </p>
        )}
        {showManual && <ManualForm form={form} setForm={setForm} busy={busy} onSubmit={connect} />}
        {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
      </div>
    );
  }

  if (!info.canManage) return <p className="text-xs text-slate-500">WhatsApp no está conectado. Pídele al dueño de la tienda que lo conecte.</p>;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
      <p className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
        <Plug className="w-4 h-4" /> Conecta el WhatsApp de tu tienda
      </p>
      <ReusePortfolio onDone={onChanged} />
      {info.embedded.available && <EmbeddedSignup info={info.embedded} onDone={onChanged} />}
      {info.embedded.available && !showManual ? (
        <button type="button" onClick={() => setShowManual(true)} className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2">
          Prefiero usar mi propia app de Meta (avanzado)
        </button>
      ) : (
        <>
          <ol className="text-[11px] text-slate-600 list-decimal pl-4 space-y-0.5">
            <li>
              En <strong>developers.facebook.com</strong> crea una app de tipo Negocio y agrega el producto <strong>WhatsApp</strong>.
            </li>
            <li>
              En tu portafolio (business.facebook.com) crea un <strong>usuario del sistema</strong> con un token permanente con los permisos whatsapp_business_messaging y
              whatsapp_business_management.
            </li>
            <li>
              Copia el <strong>identificador del número</strong> y el <strong>identificador de la cuenta de WhatsApp Business</strong> (WhatsApp → Configuración de la API) y la
              <strong> clave secreta</strong> de la app (Configuración de la app → Básica).
            </li>
          </ol>
          <ManualForm form={form} setForm={setForm} busy={busy} onSubmit={connect} />
        </>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}

// Connect a number of a portfolio already connected in another of the person's stores (same token and app).
function ReusePortfolio({ onDone }: { onDone: () => void }) {
  const [sources, setSources] = useState<{ orgId: string; name: string; displayPhone: string | null }[] | null>(null);
  const [from, setFrom] = useState('');
  const [data, setData] = useState<{ wabas: { id: string; name: string | null; numbers: { id: string; display: string; name: string | null; quality: string | null; usedBy: string | null }[] }[]; note: string | null } | null>(null);
  const [pick, setPick] = useState<{ wabaId: string; phoneNumberId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    call('/api/integrations/whatsapp/numbers', 'GET')
      .then((d) => setSources(d.sources))
      .catch(() => setSources([]));
  }, []);
  const choose = async (id: string) => {
    setFrom(id);
    setData(null);
    setPick(null);
    setMsg(null);
    if (!id) return;
    try {
      setData(await call(`/api/integrations/whatsapp/numbers?from=${encodeURIComponent(id)}`, 'GET'));
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };
  const connect = async () => {
    if (!pick) return;
    setBusy(true);
    setMsg(null);
    try {
      const d = await call('/api/integrations/whatsapp/reuse', 'POST', { from, ...pick });
      setMsg({ ok: true, text: `Conectado: ${d.displayPhone || 'número'}${d.verifiedName ? ` (${d.verifiedName})` : ''}.` });
      onDone();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };
  if (!sources?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-2">
      <p className="text-[12.5px] font-semibold text-slate-900">Usar un número del mismo portafolio que otra de tus tiendas</p>
      <p className="text-[11px] text-slate-500">Usa la conexión (token y app de Meta) que ya tiene otra tienda, y elige el número de esta. No tienes que pegar nada.</p>
      <select className={input} value={from} onChange={(e) => choose(e.target.value)}>
        <option value="">Elige la tienda con la conexión del portafolio…</option>
        {sources.map((x) => (
          <option key={x.orgId} value={x.orgId}>
            {x.name}
            {x.displayPhone ? ` (${x.displayPhone})` : ''}
          </option>
        ))}
      </select>
      {from && !data && !msg && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
      {data && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          {data.wabas.map((w) => (
            <div key={w.id}>
              <p className="sticky top-0 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                {w.name || 'Cuenta de WhatsApp'} <span className="font-mono normal-case text-slate-400">{w.id}</span>
              </p>
              {w.numbers.map((n) => (
                <label key={n.id} className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b border-slate-100 last:border-0 ${n.usedBy ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}>
                  <input type="radio" name="wa-number" disabled={Boolean(n.usedBy)} checked={pick?.phoneNumberId === n.id} onChange={() => setPick({ wabaId: w.id, phoneNumberId: n.id })} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">
                      {n.display} {n.name && <span className="text-slate-500">· {n.name}</span>}
                    </span>
                    {n.usedBy && <span className="block text-[11px] text-amber-700">Ya está en la tienda “{n.usedBy}”</span>}
                  </span>
                  {n.quality && <span className="text-[10px] text-slate-400">{n.quality === 'GREEN' ? 'calidad alta' : n.quality === 'YELLOW' ? 'calidad media' : n.quality === 'RED' ? 'calidad baja' : n.quality}</span>}
                </label>
              ))}
              {!w.numbers.length && <p className="px-3 py-2 text-xs text-slate-500">Sin números.</p>}
            </div>
          ))}
        </div>
      )}
      {data?.note && <p className="text-[11px] text-slate-500">{data.note}</p>}
      {data && (
        <button type="button" disabled={busy || !pick} onClick={connect} className={primary}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Conectar este número
        </button>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}

function ManualForm({
  form,
  setForm,
  busy,
  onSubmit,
}: {
  form: { token: string; phoneNumberId: string; wabaId: string; appSecret: string };
  setForm: (f: { token: string; phoneNumberId: string; wabaId: string; appSecret: string }) => void;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-2">
      <input className={`${input} sm:col-span-2`} type="password" autoComplete="off" placeholder="Token permanente (EAAG…)" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />
      <input className={input} inputMode="numeric" placeholder="Identificador del número" value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} />
      <input className={input} inputMode="numeric" placeholder="Identificador de la cuenta (WABA ID)" value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value })} />
      <input className={input} type="password" autoComplete="off" placeholder="Clave secreta de la app" value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} />
      <button disabled={busy || !form.token || !form.phoneNumberId || !form.wabaId || !form.appSecret} className={primary}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Verificar y conectar
      </button>
      <p className="sm:col-span-2 text-[11px] text-slate-400">Las claves se comprueban con Meta y se guardan cifradas. Nunca se vuelven a mostrar completas.</p>
    </form>
  );
}

// ---------- Vapi ----------

export function VapiConnection({ info, onChanged }: { info: IntegrationsInfo; onChanged: () => void }) {
  const v = info.vapi;
  const [form, setForm] = useState({ apiKey: '', phoneNumberId: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const d = await call('/api/integrations/vapi', 'PUT', form);
      setForm({ apiKey: '', phoneNumberId: '' });
      setMsg({ ok: true, text: `Conectado${d.number ? `: ${d.number}` : ''}.` });
      setOpen(false);
      onChanged();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      {v.connected ? (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-slate-900">Vapi conectado</span>
          <SourceBadge source={v.source} />
          {v.apiKey && <span className="font-mono text-slate-500">{v.apiKey}</span>}
          {info.canManage && v.source === 'store' && <Disconnect kind="vapi" onDone={onChanged} />}
          {info.canManage && v.source === 'env' && (
            <button type="button" onClick={() => setOpen((x) => !x)} className="font-semibold text-brand-navy hover:underline">
              Usar otra cuenta
            </button>
          )}
        </div>
      ) : (
        info.canManage && <p className="text-xs text-slate-600">Conecta tu cuenta de Vapi (vapi.ai) para llamar a los clientes y confirmar pedidos.</p>
      )}
      {info.canManage && (!v.connected || open) && (
        <form onSubmit={connect} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
          <input className={input} type="password" autoComplete="off" placeholder="Private API Key (Vapi → API Keys)" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
          <input className={input} placeholder="ID del número (Vapi → Phone Numbers)" value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} />
          <button disabled={busy || !form.apiKey || !form.phoneNumberId} className={primary}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Conectar
          </button>
        </form>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}

// ---------- simple key connections (Meta CAPI, Claude) ----------

export function KeyConnection({
  kind,
  title,
  description,
  placeholder,
  docs,
  state,
  canManage,
  onChanged,
  extra,
}: {
  kind: 'capi' | 'anthropic';
  title: string;
  description: string;
  placeholder: string;
  docs: { label: string; href: string };
  state: { connected: boolean; source?: 'env' | 'store' | 'plan'; token?: string | null; apiKey?: string | null; left?: number | null };
  canManage: boolean;
  onChanged: () => void;
  extra?: { placeholder: string; field: string };
}) {
  const [value, setValue] = useState('');
  const [extraValue, setExtraValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await call(`/api/integrations/${kind}`, 'PUT', kind === 'capi' ? { token: value, ...(extra ? { [extra.field]: extraValue } : {}) } : { apiKey: value });
      setValue('');
      setExtraValue('');
      setOpen(false);
      setMsg({ ok: true, text: 'Conectado.' });
      onChanged();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const masked = state.token || state.apiKey;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        {state.connected ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Conectado
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            <AlertCircle className="w-3 h-3" /> Sin conectar
          </span>
        )}
      </div>
      {state.connected && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <SourceBadge source={state.source} left={state.left} />
          {masked && <span className="font-mono text-slate-500">{masked}</span>}
          {canManage && state.source === 'store' && <Disconnect kind={kind} onDone={onChanged} />}
          {canManage && (state.source === 'env' || state.source === 'plan') && (
            <button type="button" onClick={() => setOpen((x) => !x)} className="font-semibold text-brand-navy hover:underline">
              Usar otra clave
            </button>
          )}
        </div>
      )}
      {canManage && (!state.connected || open) && (
        <form onSubmit={save} className="flex flex-col sm:flex-row gap-2">
          <input className={input} type="password" autoComplete="off" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
          {extra && <input className={`${input} sm:max-w-[160px]`} placeholder={extra.placeholder} value={extraValue} onChange={(e) => setExtraValue(e.target.value)} />}
          <button disabled={busy || !value} className={primary}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Conectar
          </button>
        </form>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
      <a href={docs.href} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-navy hover:underline inline-flex items-center gap-1">
        {docs.label} <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

const ADS_NOTICE: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Cuenta publicitaria conectada. Ya puedes ver tus creativos.' },
  choose: { ok: true, text: 'Listo. Ahora elige la cuenta publicitaria de esta tienda.' },
  cancelled: { ok: false, text: 'Cancelaste la conexión con Facebook.' },
  invalid: { ok: false, text: 'La conexión venció. Inténtalo de nuevo.' },
  error: { ok: false, text: 'Facebook no completó la conexión. Inténtalo de nuevo o pega un token.' },
  forbidden: { ok: false, text: 'Solo el dueño o un administrador pueden conectar Meta Ads.' },
  not_available: { ok: false, text: 'El botón de Facebook aún no está activo en la plataforma. Usa un token.' },
};

// Meta Ads (read-only): spend and creatives for the "Creativos" page. A store can read several ad accounts.
export function MetaAdsConnection({ info, onChanged }: { info: IntegrationsInfo; onChanged: () => void }) {
  const st = info.metaAds;
  const [accounts, setAccounts] = useState<{ id: string; name: string; currency: string; active: boolean; business: { id: string; name: string } | null; usedBy: string | null }[] | null>(null);
  const [owner, setOwner] = useState(false); // platform owner: can create one store per account
  const [made, setMade] = useState<{ created: { name: string }[]; skipped: { accountId: string; reason: string }[] } | null>(null);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [ids, setIds] = useState('');
  const [token, setToken] = useState('');
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('ads');
    if (p && ADS_NOTICE[p]) setMsg(ADS_NOTICE[p]);
    fetchAccount()
      .then((r) => setOwner(Boolean(r?.data?.platformAdmin)))
      .catch(() => {});
  }, []);
  const openPicker = () => {
    setPicking(true);
    setSelected(st.accounts.map((a) => a.id));
    if (accounts) return;
    call('/api/integrations/meta-ads/accounts', 'GET')
      .then((d) => setAccounts(d.accounts))
      .catch((e) => setMsg({ ok: false, text: e.message }));
  };
  useEffect(() => {
    if (st.pending && info.canManage) openPicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.pending, info.canManage]);

  const save = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await call('/api/integrations/meta-ads', 'PUT', body);
      setMsg({ ok: true, text: d.accounts.length > 1 ? `Conectadas ${d.accounts.length} cuentas.` : `Conectada: ${d.account.name}.` });
      setToken('');
      setManual(false);
      setPicking(false);
      onChanged();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };
  const days = st.expiresAt ? Math.ceil((new Date(st.expiresAt).getTime() - Date.now()) / 86400000) : null;
  const term = q.trim().toLowerCase();
  const shown = (accounts || []).filter((a) => !term || a.name.toLowerCase().includes(term) || a.id.includes(term) || (a.business?.name || '').toLowerCase().includes(term));
  // Grouped by portfolio (Business Manager), portfolios in alphabetical order.
  const groups = Object.entries(
    shown.reduce<Record<string, typeof shown>>((g, a) => {
      const k = a.business?.name || 'Sin portafolio';
      (g[k] ||= []).push(a);
      return g;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));
  const eligible = selected.filter((id) => !accounts?.find((a) => a.id === id)?.usedBy && !st.accounts.some((a) => a.id === id));
  const createStores = async () => {
    const ids = eligible;
    if (!ids.length) return setMsg({ ok: false, text: 'Marca cuentas que no estén ya en una tienda.' });
    if (!window.confirm(`Se crearán ${ids.length} tiendas, una por cada cuenta marcada, con su cuenta publicitaria ya conectada. ¿Continuar?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const d = await call('/api/account/stores/from-ads', 'POST', { accountIds: ids, copySettings: true });
      setMade(d);
      setAccounts(null);
      setPicking(false);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) => setSelected((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">Meta Ads (anuncios)</h3>
          <p className="text-xs text-slate-500">Solo lectura: trae el gasto y la imagen de cada anuncio para ver en Creativos cuáles venden y cuáles gastan sin vender.</p>
        </div>
        {st.connected ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Conectado
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            <AlertCircle className="w-3 h-3" /> Sin conectar
          </span>
        )}
      </div>

      {st.connected && !picking && (
        <div className="text-xs text-slate-600 space-y-1.5">
          <ul className="space-y-1">
            {st.accounts.map((a) => (
              <li key={a.id}>
                <b>{a.name || 'Cuenta'}</b> <span className="font-mono text-slate-400">act_{a.id}</span> {a.currency && <span className="text-slate-400">· {a.currency}</span>}
              </li>
            ))}
          </ul>
          {days !== null && (
            <p className={days <= 7 ? 'text-amber-700' : 'text-slate-500'}>
              {days > 0 ? `La conexión con Facebook vence en ${days} días: vuelve a conectar antes.` : 'La conexión con Facebook venció: vuelve a conectar.'}
            </p>
          )}
          {info.canManage && (
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <button type="button" onClick={openPicker} className="font-semibold text-brand-navy hover:underline">
                Cambiar cuentas
              </button>
              {st.oauthAvailable && (
                <a href="/api/integrations/meta-ads/oauth" className="font-semibold text-brand-navy hover:underline">
                  Volver a conectar
                </a>
              )}
              <Disconnect kind="meta-ads" onDone={onChanged} />
            </div>
          )}
        </div>
      )}

      {info.canManage && picking && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">Marca las cuentas publicitarias de esta tienda (puedes elegir varias):</p>
          {!accounts ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
          ) : accounts.length ? (
            <>
              {accounts.length > 8 && <input className={input} placeholder="Buscar por cuenta, portafolio o id…" value={q} onChange={(e) => setQ(e.target.value)} />}
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                {groups.map(([biz, list]) => (
                  <div key={biz}>
                    <div className="sticky top-0 z-[1] flex items-center justify-between bg-slate-50 px-3 py-1.5 border-b border-slate-100">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">{biz}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const ids = list.filter((a) => !a.usedBy).map((a) => a.id);
                          const all = ids.every((id) => selected.includes(id));
                          setSelected((x) => (all ? x.filter((id) => !ids.includes(id)) : Array.from(new Set([...x, ...ids]))));
                        }}
                        className="text-[11px] font-semibold text-brand-navy hover:underline shrink-0"
                      >
                        Marcar todas
                      </button>
                    </div>
                    {list.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">
                            {a.name} <span className="font-mono text-[11px] text-slate-400">act_{a.id}</span>
                          </span>
                          {a.usedBy && <span className="block text-[11px] text-amber-700">Ya está en la tienda “{a.usedBy}”</span>}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {a.currency}
                          {a.active ? '' : ' · inactiva'}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
                {!shown.length && <p className="px-3 py-2 text-xs text-slate-500">Ninguna cuenta con ese nombre.</p>}
              </div>
              <p className="text-[11px] text-slate-500">{selected.length} marcadas</p>
              <div className="flex items-center gap-2">
                <button disabled={busy || !selected.length} onClick={() => save({ accountIds: selected })} className={primary}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Usar {selected.length || ''} {selected.length === 1 ? 'cuenta' : 'cuentas'}
                </button>
                {st.connected && (
                  <button type="button" onClick={() => setPicking(false)} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                    Cancelar
                  </button>
                )}
              </div>
              {owner && (
                <div className="rounded-lg bg-sky-50 p-3 text-[12px] text-sky-900 space-y-2">
                  <p>
                    ¿Cada cuenta es un producto distinto? Crea <b>una tienda por cada cuenta marcada</b>: se llaman como la cuenta, quedan sin costo y con su cuenta publicitaria ya
                    conectada. Luego conectas el WhatsApp y el asistente de cada una.
                  </p>
                  <button type="button" disabled={busy || !eligible.length} onClick={createStores} className="h-8 px-3 rounded-lg bg-sky-700 text-white text-[12px] font-semibold disabled:opacity-50">
                    {busy ? 'Creando…' : `Crear una tienda por cada cuenta marcada (${eligible.length})`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-red-600">Tu usuario de Facebook no tiene cuentas publicitarias. Pide acceso en el Business Manager y vuelve a conectar.</p>
          )}
        </div>
      )}

      {info.canManage && !st.connected && !st.pending && (
        <div className="space-y-2">
          {st.oauthAvailable && !manual && (
            <a href="/api/integrations/meta-ads/oauth" className={`${primary} w-full sm:w-auto justify-center`}>
              <Plug className="w-4 h-4" /> Conectar con Facebook
            </a>
          )}
          {(manual || !st.oauthAvailable) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save({ accountIds: ids.split(/[\s,;]+/).filter(Boolean), token });
              }}
              className="flex flex-col gap-2"
            >
              <input className={input} placeholder="Id de las cuentas publicitarias (separa varias con coma)" value={ids} onChange={(e) => setIds(e.target.value)} />
              <input className={input} type="password" autoComplete="off" placeholder="Token de acceso con permiso ads_read" value={token} onChange={(e) => setToken(e.target.value)} />
              <button disabled={busy || !ids.trim() || !token} className={primary}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Conectar
              </button>
            </form>
          )}
          {st.oauthAvailable && (
            <button type="button" onClick={() => setManual((x) => !x)} className="text-xs font-semibold text-brand-navy hover:underline">
              {manual ? 'Usar el botón de Facebook' : 'Prefiero pegar un token'}
            </button>
          )}
        </div>
      )}
      {made && (
        <div className="rounded-lg bg-emerald-50 p-3 text-[12px] text-emerald-900 space-y-1">
          <p>
            Se {made.created.length === 1 ? 'creó 1 tienda' : `crearon ${made.created.length} tiendas`}
            {made.created.length ? `: ${made.created.slice(0, 5).map((c) => c.name).join(', ')}${made.created.length > 5 ? '…' : ''}` : ''}.
          </p>
          {made.skipped.map((x) => (
            <p key={x.accountId} className="text-amber-800">
              act_{x.accountId}: {x.reason}
            </p>
          ))}
          <a href="/tiendas" className="font-semibold underline">
            Ver Mis tiendas
          </a>
        </div>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}

// When Meta learns about a sale: the form, the confirmation or the delivery. Plus WhatsApp-ad sales.
type SaleEvent = 'submit' | 'confirmed' | 'delivered';
interface ConvLog { at: string; orderNumber: string; channel: 'landing' | 'whatsapp'; value: number; ok: boolean; error?: string }

export function ConversionsCard({ info }: { info: IntegrationsInfo }) {
  const [settings, setSettings] = useState<{ saleEvent: SaleEvent; whatsapp: boolean } | null>(null);
  const [log, setLog] = useState<ConvLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    fetch('/api/conversions')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSettings(d.settings);
          setLog(d.log || []);
        }
      })
      .catch(() => {});
  }, []);
  const save = async (patch: Partial<{ saleEvent: SaleEvent; whatsapp: boolean }>) => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await call('/api/conversions', 'PUT', patch);
      setSettings(d.settings);
      setMsg({ ok: true, text: 'Guardado.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };
  if (!settings) return null;
  const options: [SaleEvent, string, string][] = [
    ['confirmed', 'Cuando se confirma (recomendado)', 'El formulario cuenta como "Lead" y la compra se avisa cuando el cliente confirma por WhatsApp, llamada o a mano.'],
    ['delivered', 'Cuando se entrega', 'Lo más exacto, pero llega días después y Meta aprende más lento.'],
    ['submit', 'Al llenar el formulario', 'Como antes: cuenta también los pedidos que luego se cancelan.'],
  ];
  const wa = info.whatsapp;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 md:col-span-2">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900">Ventas reales a Meta</h3>
        <p className="text-xs text-slate-500">Meta optimiza tus anuncios con las compras que le avisas. Avisarle solo las ventas confirmadas hace que busque compradores reales, no curiosos.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {options.map(([id, title, text]) => (
          <button
            key={id}
            type="button"
            disabled={busy || !info.canManage}
            onClick={() => save({ saleEvent: id })}
            className={`text-left p-3 rounded-xl border text-xs disabled:cursor-default ${settings.saleEvent === id ? 'border-[#0A6CF0] bg-[#0A6CF0]/5 ring-2 ring-[#0A6CF0]/15' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
          >
            <strong className="text-slate-900 block mb-0.5">{title}</strong>
            <span className="text-slate-600">{text}</span>
          </button>
        ))}
      </div>
      <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
        <input type="checkbox" className="mt-0.5 accent-[#0A6CF0]" checked={settings.whatsapp} disabled={busy || !info.canManage} onChange={(e) => save({ whatsapp: e.target.checked })} />
        <span className="text-slate-600">
          <strong className="text-slate-900 block">Avisar también las ventas por WhatsApp</strong>
          Cuando el bot cierra un pedido de alguien que llegó desde un anuncio a WhatsApp, Meta recibe la compra con el clic de ese anuncio. Usa la conexión de WhatsApp (el token necesita el permiso whatsapp_business_manage_events).
          {wa.connected && !wa.wabaId && <span className="block mt-1 text-amber-700">Falta el ID de la cuenta de WhatsApp Business en la conexión de WhatsApp.</span>}
        </span>
      </label>
      {!info.capi.connected && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Para las ventas de tus landings conecta la API de conversiones (tarjeta de arriba) y pon tu píxel en cada landing. Sin eso, el píxel del navegador sigue avisando "Purchase" al llenar el formulario.
        </p>
      )}
      {log.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-500 mb-1">Últimas ventas avisadas</p>
          <ul className="divide-y divide-slate-100 text-xs">
            {log.slice(0, 6).map((l, i) => (
              <li key={i} className="py-1.5 flex flex-wrap items-center gap-2">
                {l.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <span className="font-medium text-slate-800">{l.orderNumber}</span>
                <span className="text-slate-500">{l.channel === 'whatsapp' ? 'WhatsApp' : 'Landing'} · ${(l.value || 0).toLocaleString('es-CO')}</span>
                <span className="text-slate-400 ml-auto shrink-0">{new Date(l.at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {!l.ok && l.error && <span className="basis-full text-[11px] text-red-600 pl-5">{l.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}
