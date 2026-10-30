'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { KeyConnection, VapiConnection, WhatsAppConnection, loadIntegrations, type IntegrationsInfo } from '@/components/integrations/Connections';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import {
  Plug,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  ExternalLink,
  MessageSquare,
  PhoneCall,
  BarChart3,
  Truck,
  Globe,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface IntegrationItem {
  id: string;
  name: string;
  category: 'voice' | 'crm' | 'tracking' | 'logistics';
  description: string;
  iconBg: string;
  status: 'connected' | 'configured_simulator' | 'requires_keys' | 'coming_soon';
  requiresKeysText: string;
  keyFields: { name: string; label: string; placeholder: string; isSecret?: boolean }[];
  docUrl: string;
}

const INTEGRATIONS: IntegrationItem[] = [
  {
    id: 'whatsapp_cloud',
    name: 'WhatsApp Business Cloud API (Oficial)',
    category: 'crm',
    description: 'Envía una plantilla de confirmación a cada pedido nuevo, recibe las respuestas en Mensajes y actualiza el estado del pedido cuando el cliente toca "Confirmar pedido" o "Cancelar".',
    iconBg: 'bg-emerald-500',
    status: 'coming_soon',
    requiresKeysText: 'Token permanente y WABA ID configurables.',
    keyFields: [
      { name: 'waba_id', label: 'WhatsApp Business Account ID', placeholder: '1098234718293' },
      { name: 'phone_id', label: 'Phone Number ID', placeholder: '1029384756102' },
      { name: 'access_token', label: 'Meta System User Access Token', placeholder: 'EAABw...', isSecret: true },
    ],
    docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  },
  {
    id: 'vapi_ai',
    name: 'Vapi AI (Voice Agents Ultra-Rápidos)',
    category: 'voice',
    description: 'Motor de voz en tiempo real con latencia inferior a 500ms para llamadas de confirmación ultra-humanas.',
    iconBg: 'bg-brand-navy',
    status: 'coming_soon',
    requiresKeysText: 'Actualmente activo en modo simulador local. Ingresa tu API Key de Vapi para marcar teléfonos reales.',
    keyFields: [
      { name: 'vapi_key', label: 'Vapi Private API Key', placeholder: 'vapi_sec_...', isSecret: true },
      { name: 'vapi_assistant_id', label: 'Assistant ID preconfigurado', placeholder: 'asst_...' },
    ],
    docUrl: 'https://vapi.ai',
  },
  {
    id: 'retell_ai',
    name: 'Retell AI (Telefonía Inteligente)',
    category: 'voice',
    description: 'Llamadas conversacionales en español neutro y latinoamericano con detección avanzada de buzón de voz.',
    iconBg: 'bg-indigo-600',
    status: 'coming_soon',
    requiresKeysText: 'Requiere credenciales de Retell AI para llamadas salientes.',
    keyFields: [
      { name: 'retell_key', label: 'Retell API Key', placeholder: 'retell_key_...', isSecret: true },
    ],
    docUrl: 'https://retellai.com',
  },
  {
    id: 'twilio_voice',
    name: 'Twilio Voice + Troncal SIP',
    category: 'voice',
    description: 'Telefonía tradicional para Colombia (+57), México (+52) y España (+34) con Caller ID de empresa verificado.',
    iconBg: 'bg-red-600',
    status: 'coming_soon',
    requiresKeysText: 'Account SID y Auth Token de Twilio.',
    keyFields: [
      { name: 'twilio_sid', label: 'Account SID', placeholder: 'AC...' },
      { name: 'twilio_token', label: 'Auth Token', placeholder: '••••••••', isSecret: true },
      { name: 'twilio_phone', label: 'Número Telefónico Saliente', placeholder: '+576017948800' },
    ],
    docUrl: 'https://twilio.com',
  },
  {
    id: 'dropi_logistics',
    name: 'Dropi / Servientrega / Interrapidísimo',
    category: 'logistics',
    description: 'Generación automática de guías de despacho y liquidación de dinero contraentrega directo a tu cuenta.',
    iconBg: 'bg-amber-600',
    status: 'coming_soon',
    requiresKeysText: 'Integrado vía webhook de despacho.',
    keyFields: [
      { name: 'dropi_token', label: 'Token de Integración Dropi / Transportadora', placeholder: 'dropi_token_...', isSecret: true },
    ],
    docUrl: 'https://dropi.co',
  },
];

interface WaStatus {
  sending: boolean;
  confirmTemplate: boolean;
  webhook: boolean;
  cron?: boolean;
  missing: string[];
}

interface WaNumber {
  display_phone_number?: string;
  verified_name?: string;
  name_status?: string;
  quality_rating?: string;
}

const NAME_STATUS: Record<string, string> = {
  APPROVED: 'Aprobado',
  AVAILABLE_WITHOUT_REVIEW: 'Disponible',
  PENDING_REVIEW: 'En revisión',
  DECLINED: 'Rechazado',
  EXPIRED: 'Vencido',
  NONE: 'Sin nombre',
  NON_EXISTS: 'Sin enviar a revisión',
};
const QUALITY: Record<string, string> = { GREEN: 'Alta', YELLOW: 'Media', RED: 'Baja', UNKNOWN: 'Sin datos' };

interface WebhookHealth {
  lastOkAt?: string;
  lastMessages?: number;
  lastStatuses?: number;
  lastInvalidAt?: string;
  lastErrorAt?: string;
  lastError?: string;
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'hace menos de un minuto';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
};
const newer = (a?: string, b?: string) => Boolean(a && (!b || new Date(a) > new Date(b)));

// Tells whether Meta's notices (button taps, replies) reach the panel, and why not.
function WebhookStatus({ h }: { h: WebhookHealth | null }) {
  const box = 'text-xs rounded-lg p-2.5';
  if (!h || (!h.lastOkAt && !h.lastInvalidAt)) {
    return (
      <p className={`${box} text-amber-800 bg-amber-50`}>
        Todavía no ha llegado ningún aviso de Meta. Revisa en Meta → Webhooks que la URL esté guardada y verificada, que el campo <strong>messages</strong> esté
        suscrito y que la app esté publicada.
      </p>
    );
  }
  if (newer(h.lastInvalidAt, h.lastOkAt)) {
    return (
      <p className={`${box} text-red-700 bg-red-50`}>
        Meta envía avisos ({ago(h.lastInvalidAt!)}) pero se rechazan porque la firma no coincide. Pon en <strong>WHATSAPP_APP_SECRET</strong> la clave secreta de
        la <strong>misma app</strong> donde configuraste el webhook (Configuración de la app → Básica) y vuelve a desplegar.
      </p>
    );
  }
  if (h.lastError && h.lastErrorAt && !newer(h.lastOkAt, h.lastErrorAt)) {
    const missingTables = !/foreign key/i.test(h.lastError) && /does not exist|schema cache|could not find the table|no table/i.test(h.lastError);
    return (
      <p className={`${box} text-red-700 bg-red-50`}>
        El aviso llegó {ago(h.lastErrorAt)} pero falló al procesarse: {h.lastError}
        {missingTables && (
          <>
            {' '}
            → Ejecuta <strong>supabase/migrations/002_whatsapp.sql</strong> en Supabase (SQL Editor).
          </>
        )}
      </p>
    );
  }
  return (
    <p className={`${box} text-emerald-700 bg-emerald-50`}>
      Último aviso de Meta recibido {ago(h.lastOkAt!)} ({h.lastMessages || 0} mensajes, {h.lastStatuses || 0} estados). El webhook funciona.
    </p>
  );
}

// Number details from Meta and test messages (only once the token and number ID are set).
function WhatsAppTester() {
  const [num, setNum] = useState<WaNumber | null | undefined>(undefined);
  const [numError, setNumError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [health, setHealth] = useState<WebhookHealth | null>(null);

  const load = () =>
    fetch('/api/whatsapp/test', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setNum(d.number || null);
        setNumError(d.error || null);
        setHealth(d.webhook || null);
      })
      .catch(() => setNumError('No se pudo consultar a Meta.'));

  useEffect(() => {
    load();
  }, []);

  const send = async (kind: 'hello' | 'confirm') => {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch('/api/whatsapp/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, kind }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      setMsg({
        ok: true,
        text: d.note || (kind === 'hello' ? 'Enviado. Debe llegarte "Hello World" en unos segundos.' : 'Enviado. Toca un botón del mensaje: si el webhook funciona, recibirás una respuesta automática.'),
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-700">Número conectado</p>
      {num === undefined && !numError ? (
        <p className="text-xs text-slate-400">Consultando a Meta…</p>
      ) : numError ? (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">Meta respondió: {numError}. Revisa WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID.</p>
      ) : num ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div><span className="block text-slate-400">Número</span><span className="font-semibold text-slate-800">{num.display_phone_number || '—'}</span></div>
          <div><span className="block text-slate-400">Nombre visible</span><span className="font-semibold text-slate-800">{num.verified_name || '—'}</span></div>
          <div><span className="block text-slate-400">Estado del nombre</span><span className="font-semibold text-slate-800">{NAME_STATUS[num.name_status || ''] || num.name_status || '—'}</span></div>
          <div><span className="block text-slate-400">Calidad</span><span className="font-semibold text-slate-800">{QUALITY[num.quality_rating || ''] || num.quality_rating || '—'}</span></div>
        </div>
      ) : null}
      <p className="text-xs font-semibold text-slate-700 pt-1">Enviar mensaje de prueba a tu celular</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+57 300 123 4567"
          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <button onClick={() => send('hello')} disabled={!!busy || phone.replace(/\D/g, '').length < 10} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-40">
          {busy === 'hello' ? 'Enviando…' : '1. Probar conexión'}
        </button>
        <button onClick={() => send('confirm')} disabled={!!busy || phone.replace(/\D/g, '').length < 10} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40">
          {busy === 'confirm' ? 'Enviando…' : '2. Probar mi plantilla'}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        &quot;Probar conexión&quot; envía la plantilla hello_world de Meta. &quot;Probar mi plantilla&quot; envía tu plantilla de confirmación con datos de ejemplo; no cambia ningún pedido.
      </p>
      {msg && <p className={`text-xs rounded-lg p-2.5 ${msg.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>{msg.text}</p>}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs font-semibold text-slate-700">Avisos de Meta (webhook)</p>
        <button onClick={load} className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2">
          Actualizar
        </button>
      </div>
      <WebhookStatus h={health} />
    </div>
  );
}

type WaMode = 'customer_first' | 'template';

interface SchedulerInfo {
  lastRunAt?: string;
  lastSource?: 'cron' | 'visita' | 'panel';
  lastCronAt?: string;
  lastDeniedAt?: string;
  lastWa?: { at: string; sent: number; failed: number; error?: string };
  lastError?: { at: string; error: string };
  cronSecret: boolean;
  baseUrl: string;
  sql: string | null;
}

const SOURCE: Record<string, string> = { cron: 'la tarea programada', visita: 'una visita a una landing', panel: 'el panel' };

// Status of the automatic check (every 5 min) and the SQL to schedule it in Supabase.
function SchedulerSetup() {
  const [info, setInfo] = useState<SchedulerInfo | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = () =>
    fetch('/api/scheduler', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  useEffect(() => {
    load();
  }, []);
  if (!info) return null;
  const cronWorks = Boolean(info.lastCronAt && Date.now() - new Date(info.lastCronAt).getTime() < 15 * 60 * 1000);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.sql || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowSql(true);
    }
  };
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">Revisión automática (cada 5 min)</p>
        <button onClick={load} className="text-[11px] font-semibold text-slate-600 underline underline-offset-2">
          Actualizar
        </button>
      </div>
      {cronWorks ? (
        <p className="text-[11px] text-emerald-700">✓ La tarea programada funciona. Última revisión {ago(info.lastCronAt!)}.</p>
      ) : (
        <p className="text-[11px] text-amber-800">
          La tarea programada aún no está activa.
          {info.lastRunAt ? ` Mientras tanto se revisa con las visitas y el panel (última vez ${ago(info.lastRunAt)}, por ${SOURCE[info.lastSource || ''] || 'el sistema'}).` : ' Mientras tanto se revisa con las visitas y el panel.'}
          {' '}Actívala para que funcione también cuando no hay movimiento:
        </p>
      )}
      {!cronWorks && info.cronSecret && info.lastDeniedAt && (!info.lastCronAt || info.lastDeniedAt > info.lastCronAt) && (
        <p className="text-[11px] text-red-600">
          Supabase sí está llamando ({ago(info.lastDeniedAt)}), pero con una clave que no coincide con CRON_SECRET (¿la cambiaste después de copiar el código?). Copia el código otra
          vez y ejecútalo en Supabase: reemplaza la tarea anterior.
        </p>
      )}
      {info.lastWa && (
        <p className={`text-[11px] ${info.lastWa.failed ? 'text-red-600' : 'text-slate-600'}`}>
          Últimas plantillas de respaldo ({ago(info.lastWa.at)}): {info.lastWa.sent} enviada(s)
          {info.lastWa.failed ? `, ${info.lastWa.failed} con error${info.lastWa.error ? `: ${info.lastWa.error}` : ''}` : ''}.
        </p>
      )}
      {info.lastError && (!info.lastRunAt || info.lastError.at >= info.lastRunAt) && (
        <p className="text-[11px] text-red-600">Error en la última revisión: {info.lastError.error}</p>
      )}
      {!cronWorks && !info.cronSecret && (
        <p className="text-[11px] text-slate-700">
          1. En Vercel agrega la variable <strong>CRON_SECRET</strong> con un texto que inventes (sin espacios) y haz <strong>Redeploy</strong>. Luego vuelve aquí: aparecerá el
          código para Supabase.
        </p>
      )}
      {!cronWorks && info.cronSecret && info.sql && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-700">
            Copia este código y pégalo en <strong>Supabase → SQL Editor → New query → Run</strong>. Solo se hace una vez. Contiene tu CRON_SECRET: no lo compartas.
          </p>
          <div className="flex gap-2">
            <button onClick={copy} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold">
              {copied ? '¡Copiado!' : 'Copiar código SQL'}
            </button>
            <button onClick={() => setShowSql((v) => !v)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700">
              {showSql ? 'Ocultar' : 'Ver código'}
            </button>
          </div>
          {showSql && (
            <textarea readOnly value={info.sql} className="w-full h-48 text-[11px] font-mono bg-white border border-slate-200 rounded-lg p-2 text-slate-700" />
          )}
          <p className="text-[11px] text-slate-500">Después de 5–10 minutos pulsa Actualizar: debe decir que la tarea programada funciona.</p>
        </div>
      )}
    </div>
  );
}

// How orders get confirmed: the customer writes first from the landing, or an automatic template.
function WhatsAppModePicker({
  mode,
  fallback,
  cron,
  templateReady,
  onChange,
}: {
  mode: WaMode | null;
  fallback: number;
  cron: boolean;
  templateReady: boolean;
  onChange: (m: WaMode, fallback: number) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (m: WaMode, fb: number) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: m, fallbackMinutes: fb }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      onChange(d.mode, d.fallbackMinutes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const choose = (m: WaMode) => m !== mode && save(m, fallback);
  const option = (m: WaMode, title: string, text: React.ReactNode) => (
    <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${mode === m ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
      <input type="radio" name="wa-mode" className="mt-0.5" checked={mode === m} disabled={saving || mode === null} onChange={() => choose(m)} />
      <span>
        <span className="block text-xs font-semibold text-slate-900">{title}</span>
        <span className="block text-[11px] text-slate-500 mt-0.5 leading-relaxed">{text}</span>
      </span>
    </label>
  );
  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-2">
      <p className="text-xs font-semibold text-slate-700">Cómo se confirman los pedidos</p>
      {option(
        'customer_first',
        'El cliente me escribe desde la landing (gratis)',
        <>
          Al terminar el pedido, la landing lo lleva a WhatsApp con el mensaje ya escrito. Cuando lo envía, el pedido pasa a Confirmado y se le responde solo.
          No usa plantilla. <strong>Pon este número de la API en el campo WhatsApp de cada landing.</strong>
        </>,
      )}
      {mode === 'customer_first' && (
        <div className="ml-7 space-y-1.5">
          <label className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
            Si el cliente no escribe en
            <select
              value={fallback}
              disabled={saving}
              onChange={(e) => save('customer_first', Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
            >
              <option value={0}>— no enviar nada —</option>
              <option value={10}>10 minutos</option>
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={120}>2 horas</option>
            </select>
            {fallback > 0 && 'le envío la plantilla con los botones.'}
          </label>
          {fallback > 0 && !templateReady && (
            <p className="text-[11px] text-amber-700">Falta la plantilla aprobada (WHATSAPP_CONFIRM_TEMPLATE) para poder enviarla.</p>
          )}
          {fallback > 0 && <SchedulerSetup />}
        </div>
      )}
      {option(
        'template',
        'Enviar la plantilla con botones a cada pedido',
        'Tu número le escribe al cliente apenas hace el pedido, con los botones Confirmar pedido / Cancelar. Funciona aunque el cliente no escriba, pero cada plantilla tiene un costo pequeño.',
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// WhatsApp card: real status from the server; credentials live in env vars, never in the browser.
function WhatsAppCard({ status, integ, onChanged }: { status: WaStatus | null | undefined; integ: IntegrationsInfo | null; onChanged: () => void }) {
  const [mode, setMode] = useState<WaMode | null>(null);
  const [fallback, setFallback] = useState(0);
  useEffect(() => {
    fetch('/api/whatsapp/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setMode(d.mode === 'customer_first' ? 'customer_first' : 'template');
        setFallback(Number(d.fallbackMinutes) || 0);
      })
      .catch(() => setMode('template'));
  }, []);
  // The template is only required when it is sent automatically.
  const ready = status && status.sending && status.webhook && (mode === 'customer_first' || status.confirmTemplate);
  const partial = status && !ready && status.sending;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col space-y-4 md:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">WhatsApp Business Cloud API (Oficial)</h3>
            <span className="text-[11px] text-slate-400">Confirmación de pedidos y bandeja de Mensajes</span>
          </div>
        </div>
        {status === undefined ? (
          <span className="text-[11px] text-slate-400">Comprobando…</span>
        ) : status === null ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">No se pudo comprobar</span>
        ) : ready ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Configurado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Key className="w-3 h-3 text-amber-600" /> {partial ? 'Configuración incompleta' : 'No configurado'}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Envía una plantilla de confirmación a cada pedido nuevo, recibe las respuestas en Mensajes y actualiza el pedido a
        &quot;Confirmado&quot; o &quot;Cancelado&quot; cuando el cliente toca un botón. Cada tienda conecta su propio número.
      </p>

      {integ ? <WhatsAppConnection info={integ} onChanged={onChanged} /> : <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
      {integ?.whatsapp.connected && (
        <a href="/plantillas" className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition">
          <span>
            <span className="block text-[13px] font-semibold text-slate-900">Plantillas y límites de mensajes</span>
            <span className="block text-[11px] text-slate-500">Crea y revisa tus plantillas por tipo, y mira cuántos clientes nuevos puedes contactar al día.</span>
          </span>
          <span className="text-xs font-semibold text-brand-navy whitespace-nowrap">Abrir →</span>
        </a>
      )}

      {status?.sending && (
        <WhatsAppModePicker
          mode={mode}
          fallback={fallback}
          cron={Boolean(status.cron)}
          templateReady={Boolean(status.confirmTemplate)}
          onChange={(m, fb) => {
            setMode(m);
            setFallback(fb);
          }}
        />
      )}
      {status?.sending && <WhatsAppTester />}

      <div className="pt-3 border-t border-slate-100">
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-brand-navy hover:underline inline-flex items-center gap-1"
        >
          <span>Ver documentación de Meta</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

interface VapiStatus {
  ready: boolean;
  webhookSecret: boolean;
  cron: boolean;
  missing: string[];
}

// Vapi card: real status; settings and history live in Llamadas IA.
function VapiCard({ status, integ, onChanged }: { status: VapiStatus | null | undefined; integ: IntegrationsInfo | null; onChanged: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-navy text-white flex items-center justify-center shadow-md">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Vapi AI (llamadas de confirmación)</h3>
            <span className="text-[11px] text-slate-400">Agente de voz con IA</span>
          </div>
        </div>
        {status === undefined ? (
          <span className="text-[11px] text-slate-400">Comprobando…</span>
        ) : status?.ready ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Configurado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Key className="w-3 h-3 text-amber-600" /> No configurado
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">
        Llama a cada cliente, confirma producto, total y dirección, y actualiza el pedido a Confirmado, Cancelado o Revisar. Reintenta si no contesta, dentro
        de tu horario.
      </p>
      <div className="pt-2 border-t border-slate-100">{integ ? <VapiConnection info={integ} onChanged={onChanged} /> : <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}</div>
      {status?.ready && !status.cron && (
        <p className="text-[11px] text-amber-700">Para reintentos y llamadas fuera de horario activa la revisión automática (CRON_SECRET), como en la tarjeta de WhatsApp.</p>
      )}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <a href="https://docs.vapi.ai" target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-navy hover:underline inline-flex items-center gap-1">
          <span>Documentación de Vapi</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <a href="/voice-ai" className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition">
          Abrir Llamadas IA
        </a>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [vapiStatus, setVapiStatus] = useState<VapiStatus | null | undefined>(undefined);
  const [waStatus, setWaStatus] = useState<WaStatus | null | undefined>(undefined);
  const [integ, setInteg] = useState<IntegrationsInfo | null>(null);
  const reload = useCallback(() => {
    fetch('/api/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setWaStatus(d.whatsapp || null);
        setVapiStatus(d.vapi || null);
      })
      .catch(() => {
        setWaStatus(null);
        setVapiStatus(null);
      });
    loadIntegrations().then(setInteg);
  }, []);
  useEffect(() => reload(), [reload]);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const filtered = INTEGRATIONS.filter((item) => selectedCategory === 'all' || item.category === selectedCategory);

  const toggleShowSecret = (fieldKey: string) => {
    setShowSecrets((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSaveIntegration = (id: string) => {
    setSavedFeedback(id);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Integraciones" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 max-w-[1280px] mx-auto w-full">
          {/* Header Description */}
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
                Integraciones
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Conecta las cuentas de tu tienda: WhatsApp, llamadas con IA, Claude y la API de conversiones de Meta. Las claves se guardan cifradas. El píxel de Meta se configura en cada landing o en Configuración.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-[13px] font-medium text-slate-600 overflow-x-auto max-w-full whitespace-nowrap">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setSelectedCategory('voice')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'voice' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Voz IA & Telefonía
              </button>
              <button
                onClick={() => setSelectedCategory('crm')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'crm' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                WhatsApp Oficial
              </button>
              <button
                onClick={() => setSelectedCategory('tracking')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'tracking' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Meta CAPI & Píxeles
              </button>
              <button
                onClick={() => setSelectedCategory('logistics')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === 'logistics' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Logística & Dropi
              </button>
            </div>
          </div>

          {integ && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <KeyConnection
                kind="anthropic"
                title="Claude (Anthropic)"
                description="La IA del asistente de WhatsApp que responde y vende por ti. Se cobra por uso en tu cuenta de Anthropic."
                placeholder="sk-ant-…"
                docs={{ label: 'Crear clave en console.anthropic.com', href: 'https://console.anthropic.com/settings/keys' }}
                state={integ.anthropic}
                canManage={integ.canManage}
                onChanged={reload}
              />
              <KeyConnection
                kind="capi"
                title="Meta: API de conversiones"
                description="Envía cada compra a Meta desde el servidor para que tus anuncios optimicen mejor (el píxel va en cada landing o en Configuración)."
                placeholder="Token de acceso de la API de conversiones"
                docs={{ label: 'Events Manager → tu píxel → Configuración', href: 'https://business.facebook.com/events_manager2' }}
                state={integ.capi}
                canManage={integ.canManage}
                onChanged={reload}
                extra={{ placeholder: 'Código de prueba (opcional)', field: 'testCode' }}
              />
            </div>
          )}

          {/* Integrations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((item) => item.id === 'whatsapp_cloud' ? (
              <WhatsAppCard key={item.id} status={waStatus} integ={integ} onChanged={reload} />
            ) : item.id === 'vapi_ai' ? (
              <VapiCard key={item.id} status={vapiStatus} integ={integ} onChanged={reload} />
            ) : (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  {/* Top Row: Icon + Title + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${item.iconBg} text-white flex items-center justify-center font-bold shadow-md`}>
                        {item.category === 'voice' && <PhoneCall className="w-5 h-5" />}
                        {item.category === 'crm' && <MessageSquare className="w-5 h-5" />}
                        {item.category === 'tracking' && <BarChart3 className="w-5 h-5" />}
                        {item.category === 'logistics' && <Truck className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-slate-900">{item.name}</h3>
                        <span className="text-[11px] text-slate-400 capitalize">{item.category}</span>
                      </div>
                    </div>

                    <div>
                      {item.status === 'connected' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Conectado</span>
                        </span>
                      )}
                      {item.status === 'configured_simulator' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-brand-navy border border-blue-200">
                          <Sparkles className="w-3 h-3 text-brand-navy" />
                          <span>Simulador Activo</span>
                        </span>
                      )}
                      {item.status === 'coming_soon' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/15">
                          Próximamente
                        </span>
                      )}
                      {item.status === 'requires_keys' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Key className="w-3 h-3 text-amber-600" />
                          <span>Faltan Credenciales</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Key inputs */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    {item.keyFields.map((field) => {
                      const fieldKey = `${item.id}_${field.name}`;
                      const isRevealed = showSecrets[fieldKey];

                      return (
                        <div key={field.name}>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            {field.label}:
                          </label>
                          <div className="relative">
                            <input
                              type={field.isSecret && !isRevealed ? 'password' : 'text'}
                              placeholder={field.placeholder}
                              disabled={item.status === 'coming_soon'}
                              defaultValue={item.status === 'connected' ? '••••••••••••••••' : ''}
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono focus:ring-1 focus:ring-brand-red focus:bg-white"
                            />
                            {field.isSecret && (
                              <button
                                type="button"
                                onClick={() => toggleShowSecret(fieldKey)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <a
                    href={item.docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-brand-navy hover:underline flex items-center gap-1"
                  >
                    <span>Ver documentación</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => handleSaveIntegration(item.id)}
                    disabled={item.status === 'coming_soon'}
                    title={item.status === 'coming_soon' ? 'Esta integración todavía no está disponible' : undefined}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savedFeedback === item.id ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>¡Guardado!</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Guardar Credenciales</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </div>
  );
}
