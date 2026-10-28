'use client';

// AI confirmation calls with Vapi: connection status, settings, test call and call history.
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import { AlertCircle, CheckCircle2, ChevronDown, Clock, ExternalLink, Loader2, PhoneCall, PhoneOff, Save } from 'lucide-react';
import { DEFAULT_VOICE_CONFIG, TIMEZONES, VOICES, type VoiceConfig } from '@/lib/voice-config';
import type { CallRow, OrderBrief } from '@/lib/server/voice-store';

interface VoiceStatus {
  ready: boolean;
  webhookSecret: boolean;
  cron: boolean;
  missing: string[];
  cloud: boolean;
  baseUrl: string;
}
type Call = CallRow & { order: OrderBrief | null };

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const input = 'w-full h-10 text-sm bg-white border border-slate-200 rounded-xl px-3 text-slate-800 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 disabled:bg-slate-50 disabled:text-slate-400';
const label = 'block text-xs font-medium text-slate-600 mb-1';

const OUTCOME: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-50 text-red-700 ring-red-600/15' },
  callback: { label: 'Volver a llamar', cls: 'bg-purple-50 text-purple-700 ring-purple-600/15' },
  review: { label: 'Revisar', cls: 'bg-blue-50 text-blue-700 ring-blue-600/15' },
};

const ENDED: Record<string, string> = {
  'customer-did-not-answer': 'No contestó',
  'customer-busy': 'Ocupado',
  voicemail: 'Buzón de voz',
  'customer-ended-call': 'El cliente colgó',
  'assistant-ended-call': 'La IA terminó la llamada',
  'assistant-said-end-call-phrase': 'La IA se despidió',
  'silence-timed-out': 'Silencio prolongado',
  'exceeded-max-duration': 'Duración máxima',
  'twilio-failed-to-connect-call': 'No se pudo conectar',
  'twilio-reported-customer-misdialed': 'Número inválido',
};

function statusChip(c: Call) {
  if (c.outcome && OUTCOME[c.outcome]) return OUTCOME[c.outcome];
  if (c.status === 'failed') return { label: 'Error', cls: 'bg-red-50 text-red-700 ring-red-600/15' };
  if (['queued', 'ringing', 'in-progress', 'forwarding'].includes(c.status)) {
    return { label: c.status === 'in-progress' ? 'En llamada' : c.status === 'ringing' ? 'Timbrando' : 'Iniciando', cls: 'bg-amber-50 text-amber-700 ring-amber-600/15' };
  }
  if (c.ended_reason && ENDED[c.ended_reason]) return { label: ENDED[c.ended_reason], cls: 'bg-slate-100 text-slate-600 ring-slate-500/15' };
  return { label: 'Terminada', cls: 'bg-slate-100 text-slate-600 ring-slate-500/15' };
}

const when = (iso: string) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const money = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;

function EnvRow({ name, ok, hint, optional }: { name: string; ok: boolean; hint: string; optional?: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" /> : <AlertCircle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${optional ? 'text-slate-400' : 'text-amber-500'}`} />}
      <div className="min-w-0">
        <code className="text-[11px] font-mono font-semibold text-slate-800 break-all">{name}</code>
        <p className="text-[11px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

export default function VoiceAiPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [cfg, setCfg] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [callsError, setCallsError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/voice/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.status) setStatus(d.status);
        if (d.config) setCfg(d.config);
        if (!d.success) setLoadError(d.error || 'No se pudo cargar la configuración.');
      })
      .catch(() => setLoadError('No se pudo cargar la configuración.'));
  }, []);

  const loadCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/calls', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      setCalls(d.calls);
      setCallsError(null);
    } catch (e: any) {
      setCallsError(e.message);
    }
  }, []);

  useEffect(() => {
    if (!status?.cloud) return;
    loadCalls();
    const t = setInterval(() => document.visibilityState === 'visible' && loadCalls(), 10000);
    return () => clearInterval(t);
  }, [status?.cloud, loadCalls]);

  const set = <K extends keyof VoiceConfig>(k: K, v: VoiceConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/voice/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      setCfg(d.config);
      setSaveMsg({ ok: true, text: 'Guardado' });
    } catch (e: any) {
      setSaveMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  const testCall = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch('/api/calls/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: testPhone }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      setTestMsg({ ok: true, text: 'Llamando a tu teléfono… El resultado aparecerá abajo en el historial.' });
      loadCalls();
    } catch (e: any) {
      setTestMsg({ ok: false, text: e.message });
    } finally {
      setTesting(false);
    }
  };

  const cloud = Boolean(status?.cloud);
  const ready = Boolean(status?.ready && cloud);
  const webhookUrl = `${status?.baseUrl || 'https://<tu-dominio>'}/api/vapi/webhook`;
  const cronUrl = `${status?.baseUrl || 'https://<tu-dominio>'}/api/cron/calls`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Llamadas IA" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 max-w-[1100px] mx-auto w-full">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Confirmación de pedidos por llamada</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Un agente de voz con IA (Vapi) llama al cliente, confirma producto, total y dirección, y marca el pedido como Confirmado, Cancelado o
              Revisar.
            </p>
          </div>

          {status && !cloud && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Las llamadas necesitan la base de datos (Supabase). Configura <code>SUPABASE_URL</code> y <code>SUPABASE_SERVICE_ROLE_KEY</code>.
            </div>
          )}
          {loadError && cloud && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}

          {/* Connection */}
          <section className={`${card} p-6 space-y-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Conexión con Vapi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Las claves se guardan como variables de entorno en Vercel (nunca en el navegador). Después hay que volver a desplegar.</p>
              </div>
              {status === null ? (
                <span className="text-[11px] text-slate-400">Comprobando…</span>
              ) : ready ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                  <AlertCircle className="w-3 h-3" /> Sin conectar
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <EnvRow name="VAPI_API_KEY" ok={!status?.missing.includes('VAPI_API_KEY')} hint="Clave privada (Vapi → API Keys)" />
              <EnvRow name="VAPI_PHONE_NUMBER_ID" ok={!status?.missing.includes('VAPI_PHONE_NUMBER_ID')} hint="Id del número importado de Twilio/Telnyx/Vonage en Vapi" />
              <EnvRow name="VAPI_WEBHOOK_SECRET" ok={Boolean(status?.webhookSecret)} optional hint="Recomendado: texto aleatorio largo que protege el webhook" />
              <EnvRow name="CRON_SECRET" ok={Boolean(status?.cron)} optional hint="Necesario para reintentos y llamadas fuera de horario" />
            </div>
            <div className="text-xs text-slate-600 space-y-1.5">
              <p>
                Webhook (se configura solo en cada llamada): <code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded break-all">{webhookUrl}</code>
              </p>
              <p>
                Tarea programada cada 5–10 min: <code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded break-all">{cronUrl}</code> con la cabecera{' '}
                <code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">Authorization: Bearer CRON_SECRET</code>
              </p>
              <p>Los pasos completos están en el README, sección &quot;Llamadas IA (Vapi)&quot;.</p>
            </div>
          </section>

          {/* Settings */}
          <section className={`${card} p-6 space-y-5`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-slate-900">Agente y reglas de llamada</h3>
              <div className="flex items-center gap-2">
                {saveMsg && <span className={`text-xs ${saveMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{saveMsg.text}</span>}
                <button
                  onClick={save}
                  disabled={!cloud || saving}
                  className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4" checked={cfg.autoCall} disabled={!cloud} onChange={(e) => set('autoCall', e.target.checked)} />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Llamar automáticamente a cada pedido nuevo</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Dentro del horario se llama enseguida (o tras la espera que pongas). Fuera de horario, la llamada queda programada. Desactivarlo solo afecta a
                  pedidos nuevos; siempre puedes llamar a mano con el botón &quot;Llamar&quot; en Pedidos.
                </span>
              </span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className={label}>Nombre del agente</span>
                <input className={input} value={cfg.agentName} disabled={!cloud} onChange={(e) => set('agentName', e.target.value)} />
              </div>
              <div>
                <span className={label}>Voz</span>
                <select className={input} value={cfg.voiceId} disabled={!cloud} onChange={(e) => set('voiceId', e.target.value)}>
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <span className={label}>Primera frase</span>
                <textarea className={`${input} h-auto py-2 min-h-[64px]`} value={cfg.firstMessage} disabled={!cloud} onChange={(e) => set('firstMessage', e.target.value)} />
                <p className="text-[11px] text-slate-400 mt-1">
                  Puedes usar {'{{cliente}}'}, {'{{agente}}'}, {'{{tienda}}'} y {'{{producto}}'}. El nombre de la tienda sale de Configuración.
                </p>
              </div>
              <div className="md:col-span-2">
                <span className={label}>Instrucciones adicionales (opcional)</span>
                <textarea
                  className={`${input} h-auto py-2 min-h-[88px]`}
                  value={cfg.extraInstructions}
                  disabled={!cloud}
                  placeholder="Ej.: El envío tarda de 2 a 4 días hábiles. Si preguntan por garantía, son 30 días."
                  onChange={(e) => set('extraInstructions', e.target.value)}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  El guion base ya confirma producto, total, dirección y quién recibe, y nunca ofrece descuentos. Aquí añades datos de tu tienda.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-1">
              <div>
                <span className={label}>Desde</span>
                <input type="time" className={input} value={cfg.hoursStart} disabled={!cloud} onChange={(e) => set('hoursStart', e.target.value)} />
              </div>
              <div>
                <span className={label}>Hasta</span>
                <input type="time" className={input} value={cfg.hoursEnd} disabled={!cloud} onChange={(e) => set('hoursEnd', e.target.value)} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <span className={label}>Zona horaria</span>
                <select className={input} value={cfg.timezone} disabled={!cloud} onChange={(e) => set('timezone', e.target.value)}>
                  {TIMEZONES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>Esperar antes de llamar (min)</span>
                <input type="number" min={0} max={1440} className={input} value={cfg.delayMinutes} disabled={!cloud} onChange={(e) => set('delayMinutes', Number(e.target.value))} />
              </div>
              <div>
                <span className={label}>Intentos máximos</span>
                <input type="number" min={1} max={6} className={input} value={cfg.maxAttempts} disabled={!cloud} onChange={(e) => set('maxAttempts', Number(e.target.value))} />
              </div>
              <div>
                <span className={label}>Reintentar cada (min)</span>
                <input type="number" min={10} max={1440} className={input} value={cfg.retryMinutes} disabled={!cloud} onChange={(e) => set('retryMinutes', Number(e.target.value))} />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Si usas la confirmación por WhatsApp, pon por ejemplo 15 minutos de espera: si el cliente confirma por WhatsApp antes, no se le llama.
            </p>
          </section>

          {/* Test call */}
          <section className={`${card} p-6 space-y-3`}>
            <h3 className="text-[15px] font-semibold text-slate-900">Llamada de prueba</h3>
            <p className="text-xs text-slate-500">Te llama el agente con un pedido de ejemplo para que escuches cómo suena. No cambia ningún pedido. Guarda antes los cambios.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input className={`${input} sm:max-w-xs`} placeholder="+57 300 123 4567" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} disabled={!ready} />
              <button
                onClick={testCall}
                disabled={!ready || testing || testPhone.replace(/\D/g, '').length < 10}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />} Llamarme ahora
              </button>
            </div>
            {testMsg && <p className={`text-xs ${testMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{testMsg.text}</p>}
          </section>

          {/* History */}
          <section className={`${card} overflow-hidden`}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-slate-900">Historial de llamadas</h3>
              <span className="text-xs text-slate-400">{calls.length} llamadas</span>
            </div>
            {callsError && cloud && <p className="m-4 text-xs text-red-600 bg-red-50 rounded-xl p-3">No se pudo cargar el historial: {callsError}</p>}
            {!callsError && calls.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-slate-500">
                Aún no hay llamadas. Aparecerán aquí cuando el agente llame a un pedido o hagas una llamada de prueba.
              </p>
            )}
            <ul className="divide-y divide-slate-100">
              {calls.map((c) => {
                const chip = statusChip(c);
                const isOpen = open === c.id;
                return (
                  <li key={c.id}>
                    <button onClick={() => setOpen(isOpen ? null : c.id)} className="w-full text-left px-6 py-3.5 flex items-center gap-3 hover:bg-slate-50/70 transition">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        {c.status === 'failed' ? <PhoneOff className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {c.is_test ? 'Llamada de prueba' : c.order ? `${c.order.customerName} · ${c.order.orderNumber}` : 'Pedido eliminado'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {c.phone} · {when(c.created_at)} · intento {c.attempt}
                          {c.duration_seconds != null ? ` · ${Math.floor(c.duration_seconds / 60)}:${String(c.duration_seconds % 60).padStart(2, '0')} min` : ''}
                          {c.cost != null ? ` · US$${Number(c.cost).toFixed(2)}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${chip.cls}`}>{chip.label}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pl-[72px] space-y-3 text-sm">
                        {c.order && (
                          <p className="text-xs text-slate-500">
                            {c.order.productName} · {c.order.comboName} · {money(c.order.totalAmount)} · {c.order.city}
                          </p>
                        )}
                        {c.error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{c.error}</p>}
                        {c.summary && (
                          <p className="text-slate-700">
                            <span className="text-xs font-semibold text-slate-500 block">Resumen</span>
                            {c.summary}
                          </p>
                        )}
                        {c.outcome_notes && (
                          <p className="text-slate-700">
                            <span className="text-xs font-semibold text-slate-500 block">Notas del agente</span>
                            {c.outcome_notes}
                          </p>
                        )}
                        {c.corrected_address && (
                          <p className="text-slate-700">
                            <span className="text-xs font-semibold text-slate-500 block">Dirección corregida</span>
                            {c.corrected_address}
                          </p>
                        )}
                        {c.recording_url && <audio controls preload="none" src={c.recording_url} className="w-full max-w-md h-10" />}
                        {c.transcript && c.transcript.length > 0 && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-1.5 max-h-72 overflow-y-auto">
                            {c.transcript.map((m, i) => (
                              <p key={i} className="text-[13px] leading-relaxed">
                                <span className={`font-semibold ${m.role === 'agent' ? 'text-emerald-700' : 'text-slate-900'}`}>{m.role === 'agent' ? 'Agente' : 'Cliente'}: </span>
                                <span className="text-slate-700">{m.text}</span>
                              </p>
                            ))}
                          </div>
                        )}
                        {!c.summary && !c.transcript?.length && !c.error && (
                          <p className="text-xs text-slate-400 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> La transcripción aparece cuando termina la llamada.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <p className="text-xs text-slate-400 flex items-center gap-1">
            Cada llamada la cobra Vapi (y tu proveedor de telefonía) por minuto.
            <a href="https://dashboard.vapi.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
              Panel de Vapi <ExternalLink className="w-3 h-3" />
            </a>
            · Revisa los pedidos en <Link href="/orders" className="underline">Pedidos</Link>.
          </p>
        </main>
      </div>

      <LandingWizardModal isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
}
