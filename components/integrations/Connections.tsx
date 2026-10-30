'use client';

// Integrations: each store connects its own WhatsApp, Vapi, Meta Conversions API and Claude keys.
import React, { useEffect, useState } from 'react';
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
        Incluida en tu plan{typeof left === 'number' ? ` · ${left.toLocaleString('es-CO')} respuestas este mes` : ''}
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
    const onMessage = (ev: MessageEvent) => {
      if (!/facebook\.com$/.test(new URL(ev.origin).hostname)) return;
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data.data?.phone_number_id) session = { phoneNumberId: data.data.phone_number_id, wabaId: data.data.waba_id };
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
      if (!code) throw new Error('Se canceló la conexión con Facebook.');
      await new Promise((r) => setTimeout(r, 800)); // the session message can arrive right after the login callback
      if (!session.phoneNumberId || !session.wabaId) throw new Error('Facebook no devolvió el número elegido. Vuelve a intentarlo y termina todos los pasos.');
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
              En tu app de Meta → <strong>WhatsApp → Configuración → Webhook</strong>, pega estos dos datos y suscribe el campo <strong>messages</strong>:
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
