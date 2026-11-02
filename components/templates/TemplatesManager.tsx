'use client';

// Plantillas: the store's WhatsApp message templates (type, review status, preview) and the number's limits.
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, CheckCircle2, Gauge, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { APPOINTMENT_PRESET, COME_BACK_PRESET, CONFIRM_PRESET } from '@/lib/wa-templates';

async function call(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const input = 'w-full h-9 text-[13px] bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-brand-navy/40 focus:ring-2 focus:ring-brand-navy/10';
const primary = 'h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50';

// ---------- limits ----------

interface Limits {
  connected: boolean;
  error?: string;
  displayPhone?: string | null;
  verifiedName?: string | null;
  nameStatus?: string | null;
  quality?: string | null;
  tier?: string | null;
  limit?: number | null;
  throughput?: string | null;
  status?: string | null;
  used24h?: number | null;
}

const QUALITY: Record<string, { label: string; cls: string; help: string }> = {
  GREEN: { label: 'Alta', cls: 'bg-emerald-50 text-emerald-700', help: 'Tus clientes reciben bien tus mensajes.' },
  YELLOW: { label: 'Media', cls: 'bg-amber-50 text-amber-700', help: 'Algunos clientes bloquean o reportan tus mensajes. Revisa qué envías.' },
  RED: { label: 'Baja', cls: 'bg-red-50 text-red-700', help: 'Muchos bloqueos o reportes: Meta puede bajar tu límite o pausar plantillas.' },
  UNKNOWN: { label: 'Sin datos', cls: 'bg-slate-100 text-slate-600', help: 'Meta aún no tiene suficientes mensajes para calificar.' },
};
const NAME_STATUS: Record<string, string> = { APPROVED: 'Aprobado', AVAILABLE_WITHOUT_REVIEW: 'Disponible', PENDING_REVIEW: 'En revisión', DECLINED: 'Rechazado', EXPIRED: 'Vencido', NONE: 'Sin enviar', NON_EXISTS: 'Sin enviar' };
const fmt = (n: number) => n.toLocaleString('es-CO');

function LimitsCard() {
  const [l, setL] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    call('/api/whatsapp/limits')
      .then(setL)
      .catch((e) => setL({ connected: true, error: e.message }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (!l) return <div className={`${card} p-5`}>{loading && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}</div>;
  if (!l.connected)
    return (
      <div className={`${card} p-5 text-sm text-slate-600`}>
        Conecta tu WhatsApp en{' '}
        <Link href="/integrations" className="font-semibold text-brand-navy hover:underline">
          Integraciones
        </Link>{' '}
        para ver tus límites y administrar plantillas.
      </div>
    );

  const q = QUALITY[l.quality || 'UNKNOWN'] || QUALITY.UNKNOWN;
  const used = l.used24h ?? null;
  const pct = typeof l.limit === 'number' && used !== null ? Math.min(100, Math.round((used / l.limit) * 100)) : null;
  const restricted = l.status && !['CONNECTED', 'PENDING'].includes(l.status);

  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-brand-navy" /> Límites de tu número
          </h2>
          <p className="text-xs text-slate-500">
            {l.displayPhone || 'Tu número'}
            {l.verifiedName ? ` · ${l.verifiedName}` : ''}
          </p>
        </div>
        <button onClick={load} className="text-slate-400 hover:text-slate-700" aria-label="Actualizar límites">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {l.error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">Meta respondió: {l.error}</p>}
      {restricted && (
        <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2.5 flex gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Meta marcó el número como {l.status}. Revisa WhatsApp Manager: puede que no estés pudiendo enviar mensajes.
        </p>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
          <p className="text-[11px] text-slate-500">Clientes nuevos al día (límite de Meta)</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">
            {used !== null ? fmt(used) : '—'}
            <span className="text-sm font-normal text-slate-500"> de {l.limit === null ? 'ilimitados' : typeof l.limit === 'number' ? fmt(l.limit) : 'límite no disponible'}</span>
          </p>
          {pct !== null && (
            <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
          )}
          <p className="text-[11px] text-slate-500 mt-1.5">
            Cuenta los clientes distintos a los que <strong>escribes primero con una plantilla</strong> en 24 horas. Responder a quien te escribió no cuenta. Meta lo sube solo si envías
            con buena calidad.
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">Calidad del número</p>
          <span className={`inline-block mt-1 text-sm font-semibold px-2 py-0.5 rounded-lg ${q.cls}`}>{q.label}</span>
          <p className="text-[11px] text-slate-500 mt-1.5">{q.help}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 space-y-2">
          <div>
            <p className="text-[11px] text-slate-500">Velocidad de envío</p>
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> {l.throughput === 'HIGH' ? 'Alta (hasta ~1.000 por segundo)' : l.throughput ? 'Estándar (~80 por segundo)' : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Nombre visible</p>
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> {NAME_STATUS[l.nameStatus || ''] || l.nameStatus || '—'}
            </p>
          </div>
        </div>
      </div>
      {pct !== null && pct >= 80 && (
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2.5">
          Vas en el {pct}% del límite de hoy. Si lo pasas, Meta no entrega las plantillas a clientes nuevos hasta que pasen 24 horas. Usa el modo &quot;El cliente me escribe desde
          la landing&quot; (Integraciones) para no gastar límite.
        </p>
      )}
    </div>
  );
}

// ---------- templates ----------

interface Tpl {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  rejected_reason?: string;
  components?: { type: string; text?: string; format?: string; buttons?: { type: string; text: string }[] }[];
}

const TYPES: Record<string, { label: string; cls: string; help: string }> = {
  UTILITY: { label: 'Utilidad', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20', help: 'Avisos de un pedido: confirmación, envío, entrega. Son las más baratas.' },
  MARKETING: { label: 'Marketing', cls: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20', help: 'Ofertas y promociones. Cuestan más y Meta las limita más.' },
  AUTHENTICATION: { label: 'Autenticación', cls: 'bg-slate-100 text-slate-700 ring-slate-500/20', help: 'Códigos de verificación.' },
};
const STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: 'Aprobada', cls: 'bg-emerald-50 text-emerald-700' },
  PENDING: { label: 'En revisión', cls: 'bg-amber-50 text-amber-700' },
  IN_APPEAL: { label: 'En apelación', cls: 'bg-amber-50 text-amber-700' },
  REJECTED: { label: 'Rechazada', cls: 'bg-red-50 text-red-700' },
  PAUSED: { label: 'Pausada', cls: 'bg-slate-100 text-slate-600' },
  DISABLED: { label: 'Desactivada', cls: 'bg-slate-100 text-slate-600' },
};
const REJECTED: Record<string, string> = {
  ABUSIVE_CONTENT: 'contenido no permitido',
  INVALID_FORMAT: 'formato inválido',
  PROMOTIONAL: 'es promocional (créala como Marketing)',
  TAG_CONTENT_MISMATCH: 'el tipo no coincide con el contenido',
  SCAM: 'parece engañosa',
};

function Bubble({ t }: { t: Tpl }) {
  const header = t.components?.find((c) => c.type === 'HEADER');
  const body = t.components?.find((c) => c.type === 'BODY')?.text || '';
  const footer = t.components?.find((c) => c.type === 'FOOTER')?.text;
  const buttons = t.components?.find((c) => c.type === 'BUTTONS')?.buttons || [];
  const parts = body.split(/(\{\{\d+\}\})/g);
  return (
    <div className="rounded-xl bg-[#efeae2]/70 p-3">
      <div className="bg-white rounded-lg shadow-sm max-w-full overflow-hidden">
        <div className="px-3 py-2 text-[13px] text-slate-800 whitespace-pre-wrap break-words">
          {header?.text && <p className="font-semibold mb-1">{header.text}</p>}
          {header && !header.text && header.format && <p className="text-[11px] text-slate-400 mb-1">[{header.format.toLowerCase()}]</p>}
          {parts.map((p, i) =>
            /^\{\{\d+\}\}$/.test(p) ? (
              <span key={i} className="px-1 rounded bg-sky-100 text-sky-800 font-mono text-[11px]">
                {p}
              </span>
            ) : (
              <React.Fragment key={i}>{p}</React.Fragment>
            ),
          )}
          {footer && <p className="text-[11px] text-slate-400 mt-1">{footer}</p>}
        </div>
        {buttons.length > 0 && (
          <div className="border-t border-slate-100 divide-y divide-slate-100">
            {buttons.map((b, i) => (
              <p key={i} className="text-center text-[13px] text-sky-600 font-medium py-1.5">
                {b.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TemplatesManager() {
  const [list, setList] = useState<Tpl[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ canManage: boolean; source?: string; confirmTemplate?: string | null; connected: boolean; wabaId?: string | null } | null>(null);
  const [type, setType] = useState<string>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ name: '', language: 'es', category: 'UTILITY', body: '', examples: '', buttons: '' });

  const loadInfo = () =>
    call('/api/integrations')
      .then((d) => setInfo({ canManage: d.canManage, source: d.whatsapp.source, confirmTemplate: d.whatsapp.confirmTemplate, connected: d.whatsapp.connected, wabaId: d.whatsapp.wabaId }))
      .catch(() => setInfo({ canManage: false, connected: false }));
  const load = () =>
    call('/api/integrations/whatsapp/templates')
      .then((d) => (setList(d.templates), setError(null)))
      .catch((e) => (setError(e.message), setList([])));
  useEffect(() => {
    loadInfo();
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list?.length || 0 };
    for (const t of list || []) c[t.category] = (c[t.category] || 0) + 1;
    return c;
  }, [list]);
  const shown = (list || []).filter((t) => type === 'all' || t.category === type);
  const hasPreset = list?.some((t) => t.name === CONFIRM_PRESET.name);
  const hasApptPreset = list?.some((t) => t.name === APPOINTMENT_PRESET.name);
  const hasComeBackPreset = list?.some((t) => t.name === COME_BACK_PRESET.name);
  const varsIn = (f.body.match(/\{\{\d+\}\}/g) || []).length;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await Promise.all([load(), loadInfo()]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <LimitsCard />

      <div className={`${card} p-5 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Plantillas de WhatsApp</h2>
            <p className="text-xs text-slate-500">Mensajes aprobados por Meta para escribirle primero a un cliente (fuera de la conversación de 24 horas).</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => run('reload', load)} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50" aria-label="Actualizar">
              <RefreshCw className={`w-4 h-4 ${busy === 'reload' ? 'animate-spin' : ''}`} />
            </button>
            {info?.canManage && info.connected && (
              <button onClick={() => setCreating((v) => !v)} className={primary}>
                <Plus className="w-4 h-4" /> Nueva plantilla
              </button>
            )}
          </div>
        </div>

        {/* types */}
        <div className="flex flex-wrap gap-1.5">
          {[['all', 'Todas'], ...Object.entries(TYPES).map(([k, v]) => [k, v.label])].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setType(k)}
              className={`h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5 ${type === k ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {label} <span className={`text-[11px] ${type === k ? 'text-white/70' : 'text-slate-400'}`}>{counts[k] || 0}</span>
            </button>
          ))}
        </div>
        {type !== 'all' && TYPES[type] && <p className="text-[11px] text-slate-500">{TYPES[type].help}</p>}

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>}

        {/* new template */}
        {creating && info?.canManage && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            {!hasPreset && (
              <div className="rounded-lg bg-white border border-emerald-200 p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-[13px] font-semibold text-slate-900">Confirmación de pedidos (recomendada)</p>
                  <p className="text-[11px] text-slate-500">La que usa Konnexa para confirmar cada pedido con los botones Confirmar pedido / Cancelar.</p>
                </div>
                <button onClick={() => run('preset', () => call('/api/integrations/whatsapp/templates', 'POST', { preset: 'confirm' }).then(() => setCreating(false)))} disabled={busy !== null} className={primary}>
                  {busy === 'preset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Crearla
                </button>
              </div>
            )}
            {!hasApptPreset && (
              <div className="rounded-lg bg-white border border-sky-200 p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-[13px] font-semibold text-slate-900">Recordatorio de citas</p>
                  <p className="text-[11px] text-slate-500">Para negocios con citas: recuerda la cita con los botones Confirmar cita / Cancelar cita.</p>
                </div>
                <button onClick={() => run('preset-appt', () => call('/api/integrations/whatsapp/templates', 'POST', { preset: 'appointment' }).then(() => setCreating(false)))} disabled={busy !== null} className={primary}>
                  {busy === 'preset-appt' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Crearla
                </button>
              </div>
            )}
            {!hasComeBackPreset && (
              <div className="rounded-lg bg-white border border-violet-200 p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-[13px] font-semibold text-slate-900">Vuelve pronto (citas)</p>
                  <p className="text-[11px] text-slate-500">Marketing: invita a volver a quien ya asistió, con el botón Agendar cita. Solo para clientes que aceptaron recibir mensajes.</p>
                </div>
                <button onClick={() => run('preset-back', () => call('/api/integrations/whatsapp/templates', 'POST', { preset: 'comeback' }).then(() => setCreating(false)))} disabled={busy !== null} className={primary}>
                  {busy === 'preset-back' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Crearla
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run('custom', () =>
                  call('/api/integrations/whatsapp/templates', 'POST', {
                    ...f,
                    examples: f.examples.split('|').map((x) => x.trim()),
                    buttons: f.buttons.split('|').map((x) => x.trim()).filter(Boolean),
                  }).then(() => {
                    setCreating(false);
                    setF({ name: '', language: 'es', category: 'UTILITY', body: '', examples: '', buttons: '' });
                  }),
                );
              }}
              className="space-y-2"
            >
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">Nombre</span>
                  <input className={input} placeholder="pedido_en_camino" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">Tipo</span>
                  <select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                    <option value="UTILITY">Utilidad (pedidos, envíos)</option>
                    <option value="MARKETING">Marketing (ofertas)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">Idioma</span>
                  <select className={input} value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>
                    <option value="es">Español</option>
                    <option value="es_CO">Español (Colombia)</option>
                    <option value="es_MX">Español (México)</option>
                    <option value="en_US">Inglés</option>
                  </select>
                </label>
              </div>
              <p className="text-[11px] text-slate-500">{TYPES[f.category]?.help} Si el texto es promocional y lo marcas como Utilidad, Meta lo rechaza o lo cambia a Marketing.</p>
              <textarea className={`${input} h-auto py-2`} rows={3} placeholder="Hola {{1}}, tu pedido {{2}} ya va en camino 🚚" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
              {varsIn > 0 && (
                <input className={input} placeholder={`Ejemplo para cada variable, separados por | (${varsIn}): Laura | LP-12345`} value={f.examples} onChange={(e) => setF({ ...f, examples: e.target.value })} />
              )}
              <input className={input} placeholder="Botones de respuesta rápida, separados por | (opcional, máx. 3)" value={f.buttons} onChange={(e) => setF({ ...f, buttons: e.target.value })} />
              <div className="flex gap-2">
                <button disabled={busy !== null || !f.name || !f.body} className={primary}>
                  {busy === 'custom' && <Loader2 className="w-4 h-4 animate-spin" />} Enviar a revisión de Meta
                </button>
                <button type="button" onClick={() => setCreating(false)} className="h-9 px-3 text-[13px] text-slate-500">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {list === null && <Loader2 className="w-5 h-5 animate-spin text-slate-300" />}
        {list && shown.length === 0 && !error && <p className="text-sm text-slate-500">{list.length ? 'No hay plantillas de este tipo.' : 'Aún no tienes plantillas. Crea la de confirmación de pedidos.'}</p>}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((t) => {
            const ty = TYPES[t.category] || { label: t.category, cls: 'bg-slate-100 text-slate-700 ring-slate-500/20', help: '' };
            const st = STATUS[t.status] || { label: t.status, cls: 'bg-slate-100 text-slate-600' };
            const isConfirm = info?.confirmTemplate === t.name;
            return (
              <div key={t.id} className={`rounded-xl border p-3 space-y-2.5 ${isConfirm ? 'border-brand-navy/40 ring-1 ring-brand-navy/10' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-mono font-semibold text-slate-900 truncate">{t.name}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${ty.cls}`}>{ty.label}</span>
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                      <span className="text-[11px] text-slate-400">{t.language}</span>
                    </div>
                  </div>
                  {info?.canManage && (
                    <button
                      onClick={() => window.confirm(`¿Eliminar ${t.name} en Meta? No se puede deshacer.`) && run(`del-${t.name}`, () => call(`/api/integrations/whatsapp/templates?name=${encodeURIComponent(t.name)}`, 'DELETE'))}
                      className="p-1 text-slate-300 hover:text-red-600"
                      aria-label={`Eliminar ${t.name}`}
                    >
                      {busy === `del-${t.name}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <Bubble t={t} />
                {t.status === 'REJECTED' && t.rejected_reason && t.rejected_reason !== 'NONE' && (
                  <p className="text-[11px] text-red-600">Motivo: {REJECTED[t.rejected_reason] || t.rejected_reason}</p>
                )}
                {isConfirm ? (
                  <p className="text-[11px] font-semibold text-brand-navy flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Se usa para confirmar pedidos
                  </p>
                ) : (
                  info?.canManage &&
                  info.source === 'store' &&
                  t.status === 'APPROVED' && (
                    <button
                      onClick={() => run(`use-${t.name}`, () => call('/api/integrations/whatsapp', 'PUT', { confirmTemplate: t.name, templateLang: t.language }))}
                      className="text-[11px] font-semibold text-brand-navy hover:underline"
                    >
                      {busy === `use-${t.name}` ? 'Guardando…' : 'Usar para confirmar pedidos'}
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
        {info?.source === 'env' && <p className="text-[11px] text-slate-400">La plantilla que confirma pedidos en tu número de Vercel se elige con WHATSAPP_CONFIRM_TEMPLATE.</p>}
      </div>
    </div>
  );
}
