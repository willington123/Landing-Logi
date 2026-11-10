'use client';

// AI assistant for WhatsApp (Claude): settings and a simulator to try it before turning it on.
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Search, Send, Sparkles, UserRound } from 'lucide-react';
import { BOT_MODELS, DEFAULT_BOT, FOLLOW_UP_HOURS, MAX_BUSINESS_INFO, RESUME_HOURS, type BotSettings } from '@/lib/bot';
import { isCloud } from '@/lib/cloud';

interface SimMsg {
  direction: 'in' | 'out';
  text: string;
  notes?: string[]; // what the assistant did (tools)
}

// Cost shown in the simulator, at the list prices of the chosen model (USD per million tokens).
const usd = (u: { input: number; output: number; cacheRead: number; cacheWrite: number }, model: BotSettings['model']) => {
  const p = (BOT_MODELS.find((m) => m.id === model) || BOT_MODELS[1]).price;
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000;
};

// Length of the store's information and what it adds to each reply (the assistant reads it every time; cached reads are cheap).
function InfoSize({ text, model }: { text: string; model: BotSettings['model'] }) {
  const chars = text.length;
  const pages = chars / 3000;
  const tokens = Math.round(chars / 3.5);
  const p = (BOT_MODELS.find((m) => m.id === model) || BOT_MODELS[1]).price;
  const cached = (tokens * p.cacheRead) / 1_000_000;
  const fresh = (tokens * p.cacheWrite) / 1_000_000;
  const money = (v: number) => `US$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`;
  const near = chars > MAX_BUSINESS_INFO * 0.9;
  return (
    <span className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px]">
      <span className={near ? 'text-amber-700 font-medium' : 'text-slate-400'}>
        {chars.toLocaleString('es-CO')} / {MAX_BUSINESS_INFO.toLocaleString('es-CO')} caracteres{chars ? ` · unas ${pages < 1 ? 'menos de 1' : Math.round(pages)} ${Math.round(pages) === 1 && pages >= 1 ? 'página' : 'páginas'}` : ''}
      </span>
      {chars > 6000 && (
        <span className="text-slate-500">
          Suma unos {money(cached)} por respuesta ({money(fresh)} cuando la IA lo vuelve a leer completo, tras 5 min sin mensajes).
        </span>
      )}
    </span>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative w-11 h-6 rounded-full transition shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function WhatsAppBot() {
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [cfg, setCfg] = useState<BotSettings | null>(null);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fuStats, setFuStats] = useState<{ sent: number; recovered: number; revenue: number } | null>(null);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [savedJson, setSavedJson] = useState(''); // what is saved, to tell unsaved changes

  // simulator
  const [sim, setSim] = useState<SimMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [phone, setPhone] = useState('');
  const [thinking, setThinking] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [cost, setCost] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isCloud().then((c) => {
      setCloud(c);
      if (!c) return;
      fetch('/api/whatsapp/bot', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (!d.success) return setLoadError(d.error);
          setCfg(d.settings);
          setSavedJson(JSON.stringify(d.settings));
          setConfigured(d.configured);
          setFuStats(d.followUpStats || null);
          setPrices(d.prices || []);
        })
        .catch((e) => setLoadError(String(e?.message || e)));
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [sim, thinking]);

  // Leaving with unsaved changes: the assistant would keep using the old text.
  const dirty = Boolean(cfg && savedJson && JSON.stringify(cfg) !== savedJson);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async (next?: BotSettings) => {
    const body = next || cfg;
    if (!body) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/whatsapp/bot', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: body }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      setCfg(d.settings);
      setSavedJson(JSON.stringify(d.settings));
      setMsg({ ok: true, text: d.settings.enabled ? 'Guardado. El asistente ya responde los mensajes nuevos.' : 'Guardado. El asistente está apagado.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const sendSim = async () => {
    const text = draft.trim();
    if (!text || thinking || !cfg) return;
    const history: SimMsg[] = [...sim, { direction: 'in', text }];
    setSim(history);
    setDraft('');
    setThinking(true);
    setSimError(null);
    try {
      const res = await fetch('/api/whatsapp/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: cfg, phone, history: history.map(({ direction, text }) => ({ direction, text })) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      const notes: string[] = [];
      for (const t of d.toolCalls || []) {
        if (t.name === 'consultar_pedidos') notes.push(`🔎 Consultó los pedidos del cliente (${t.result?.pedidos?.length ?? 0} encontrados)`);
        if (t.name === 'enviar_medios' && !t.result?.error)
          notes.push(
            t.result?.fotos_enviadas || t.result?.nota_de_voz_enviada
              ? `📎 Envió ${[t.result.fotos_enviadas ? `${t.result.fotos_enviadas} ${t.result.fotos_enviadas === 1 ? 'foto' : 'fotos'}` : '', t.result.nota_de_voz_enviada ? 'la nota de voz' : ''].filter(Boolean).join(' y ')} (simulación: en WhatsApp llegan antes de este mensaje, una sola vez por cliente)`
              : '📎 No reenvió las fotos ni la nota de voz: ya se las había enviado',
          );
        if (t.name === 'pasar_a_humano') notes.push(`👤 Pasó el chat a una persona: ${t.input?.motivo || ''}`);
        if (t.name === 'crear_pedido')
          notes.push(
            t.result?.ok
              ? `🛒 Tomó el pedido: ${t.result.oferta} · ${t.result.total} · ${t.result.direccion} (simulación: no se creó)`
              : `📝 Faltaban datos: ${String(t.result?.error || '').replace(/ Pídeselos al cliente\.?/, '')}`,
          );
      }
      if (d.refused) notes.push('⚠️ El asistente no quiso responder este mensaje: pasaría a una persona.');
      setCost((c) => c + usd(d.usage, cfg?.model || DEFAULT_BOT.model));
      setSim([...history, { direction: 'out', text: d.reply || '(sin respuesta)', notes }]);
    } catch (e: any) {
      setSimError(e.message);
    } finally {
      setThinking(false);
    }
  };

  const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
  if (cloud === false) return null;
  const set = (patch: Partial<BotSettings>) => cfg && setCfg({ ...cfg, ...patch });

  return (
    <section id="asistente" className={`scroll-mt-20 ${card} p-5 md:p-6 space-y-5`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">Asistente de WhatsApp con IA</h2>
          <p className="text-[13px] text-slate-500">
            Responde a tus clientes como una persona del equipo: dudas del producto, precios, envío y estado de sus pedidos. Si no sabe algo o el cliente tiene un reclamo, pasa el chat a
            una persona. Funciona con Claude, de Anthropic.
          </p>
        </div>
        {cfg && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${cfg.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>{cfg.enabled ? 'Activo' : 'Apagado'}</span>
            <Toggle on={cfg.enabled} onChange={(v) => save({ ...cfg, enabled: v })} label="Activar asistente" />
          </div>
        )}
      </div>

      {loadError && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">No se pudo cargar: {loadError}</p>}
      {!cfg && !loadError && <Loader2 className="w-5 h-5 animate-spin text-slate-300" />}

      {cfg && !configured && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-900 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Para usarlo falta la clave de Claude: crea una en <strong>console.anthropic.com → API Keys</strong>, agrégala en Vercel como <code className="text-xs">ANTHROPIC_API_KEY</code> y
            haz Redeploy. Mientras tanto puedes dejar lista la configuración.
          </span>
        </div>
      )}

      {cfg && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Settings */}
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Nombre del asistente</span>
                <input value={cfg.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} className="mt-1 w-full h-9 text-[13px] border border-slate-200 rounded-lg px-3" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Trato</span>
                <select value={cfg.formal ? 'usted' : 'tu'} onChange={(e) => set({ formal: e.target.value === 'usted' })} className="mt-1 w-full h-9 text-[13px] border border-slate-200 rounded-lg px-2 bg-white">
                  <option value="tu">Tutea al cliente (tú)</option>
                  <option value="usted">Trata de usted</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Cuándo responde</span>
                <select value={cfg.mode} onChange={(e) => set({ mode: e.target.value as BotSettings['mode'] })} className="mt-1 w-full h-9 text-[13px] border border-slate-200 rounded-lg px-2 bg-white">
                  <option value="always">Siempre</option>
                  <option value="away">Solo fuera de horario</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Máx. respuestas por cliente al día</span>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={cfg.maxRepliesPerDay}
                  onChange={(e) => set({ maxRepliesPerDay: Number(e.target.value) })}
                  className="mt-1 w-full h-9 text-[13px] border border-slate-200 rounded-lg px-3"
                />
              </label>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
              <Toggle on={cfg.social} onChange={(v) => set({ social: v })} label="Responder Messenger e Instagram" />
              <span>
                <span className="block text-[13px] font-semibold text-slate-900">Responder también Messenger e Instagram</span>
                <span className="block text-[11px] text-slate-600">Los chats de tus páginas conectadas (Automatizaciones → Comentarios) llegan a Mensajes y el asistente los atiende igual que WhatsApp.</span>
              </span>
            </label>
            <div>
              <span className="text-xs font-medium text-slate-600">Inteligencia del asistente</span>
              <div className="mt-1 grid gap-2">
                {BOT_MODELS.map((m) => (
                  <label key={m.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${cfg.model === m.id ? 'border-brand-blue bg-brand-blue/[0.04]' : 'border-slate-200'}`}>
                    <input type="radio" name="bot-model" checked={cfg.model === m.id} onChange={() => set({ model: m.id })} className="mt-1 accent-brand-blue" />
                    <span>
                      <span className="block text-[13px] font-semibold text-slate-900">{m.label}</span>
                      <span className="block text-[11px] text-slate-600">{m.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 cursor-pointer">
              <Toggle on={cfg.takeOrders} onChange={(v) => set({ takeOrders: v })} label="Tomar pedidos en el chat" />
              <span>
                <span className="block text-[13px] font-semibold text-slate-900">Cerrar la venta en el chat</span>
                <span className="block text-[11px] text-slate-600">
                  Recomienda la oferta, resuelve objeciones, pide los datos de envío (con la dirección completa), confirma el resumen y crea el pedido ya confirmado en Pedidos. Si lo
                  apagas, manda al cliente a comprar en la landing.
                </span>
              </span>
            </label>
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-2.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <Toggle on={cfg.followUp.enabled} onChange={(v) => set({ followUp: { ...cfg.followUp, enabled: v } })} label="Seguimiento a quien no compró" />
                <span>
                  <span className="block text-[13px] font-semibold text-slate-900">Seguimiento a quien no compró</span>
                  <span className="block text-[11px] text-slate-600">
                    Si el cliente deja de responder sin hacer el pedido, el asistente le escribe una sola vez, retomando la conversación (sin presionar). Va dentro de las 24 h gratis de
                    WhatsApp, entre 8 a. m. y 8 p. m. No escribe si el cliente dijo que no, ya compró o una persona está atendiendo el chat.
                  </span>
                </span>
              </label>
              {cfg.followUp.enabled && (
                <div className="grid sm:grid-cols-2 gap-3 pl-14">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Escribirle después de</span>
                    <select
                      value={cfg.followUp.afterHours}
                      onChange={(e) => set({ followUp: { ...cfg.followUp, afterHours: Number(e.target.value) } })}
                      className="mt-1 w-full h-9 text-[13px] border border-slate-200 rounded-lg px-2 bg-white"
                    >
                      {FOLLOW_UP_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h} {h === 1 ? 'hora' : 'horas'} sin respuesta
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-slate-700 sm:mt-5">
                    <input type="checkbox" className="accent-[#0A6CF0]" checked={cfg.followUp.onlyAds} onChange={(e) => set({ followUp: { ...cfg.followUp, onlyAds: e.target.checked } })} />
                    Solo chats que llegaron desde un anuncio
                  </label>
                </div>
              )}
              {fuStats && fuStats.sent > 0 && (
                <p className="text-[12px] text-slate-700 pl-14">
                  Últimos 30 días: <strong>{fuStats.sent}</strong> {fuStats.sent === 1 ? 'seguimiento' : 'seguimientos'}, <strong>{fuStats.recovered}</strong> {fuStats.recovered === 1 ? 'compró' : 'compraron'} después
                  {fuStats.revenue > 0 && <> (${fuStats.revenue.toLocaleString('es-CO')})</>}.
                </p>
              )}
              <p className="text-[11px] text-slate-500 pl-14">Necesita la revisión automática cada 5 minutos (Llamadas IA → Tareas programadas). Cada seguimiento cuenta como una respuesta de IA.</p>
            </div>
            {cfg.mode === 'away' && <p className="text-[11px] text-slate-500">Usa el horario del “Mensaje fuera de horario” de abajo. En horario de atención responden las personas.</p>}
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Información del negocio</span>
              <span className="block text-[11px] text-slate-400">
                Envíos, pago, garantía, cambios, horarios… El asistente solo responde con esto y con lo que hay en tus landings publicadas (productos, ofertas y preguntas frecuentes).
              </span>
              <textarea value={cfg.businessInfo} onChange={(e) => set({ businessInfo: e.target.value })} rows={14} maxLength={MAX_BUSINESS_INFO} className="mt-1.5 w-full text-[13px] border border-slate-200 rounded-xl px-3 py-2 resize-y min-h-[220px]" />
              <InfoSize text={cfg.businessInfo} model={cfg.model} />
            </label>
            <PricesBox prices={prices} text={cfg.businessInfo} />
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2.5">
              <p className="text-[13px] font-semibold text-slate-900">🙋 Cuándo pasa el chat a un asesor</p>
              <p className="text-[11px] text-slate-600">
                Siempre lo pasa cuando el cliente pide hablar con una persona, tiene un reclamo o está molesto, quiere cancelar o cambiar un pedido, pregunta algo que no está en tu
                información, o habla de devoluciones de dinero o pagos por adelantado. Te avisa con un sonido y aparece en Mensajes → “Esperan asesor”.
              </p>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Tus casos (uno por línea, opcional)</span>
                <textarea
                  value={cfg.handoffRules}
                  onChange={(e) => set({ handoffRules: e.target.value })}
                  rows={3}
                  maxLength={3000}
                  placeholder={'Pide precio al por mayor o más de 10 unidades\nPregunta por la garantía de un pedido entregado\nQuiere pagar con transferencia'}
                  className="mt-1 w-full text-[13px] border border-slate-200 rounded-xl px-3 py-2 bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">El asistente vuelve a atender el chat</span>
                <select
                  value={cfg.resumeAfterHours}
                  onChange={(e) => set({ resumeAfterHours: Number(e.target.value) })}
                  className="mt-1 w-full h-9 text-[13px] border border-slate-200 rounded-lg px-2 bg-white"
                >
                  {RESUME_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h === 0 ? 'Nunca: solo cuando lo devuelvas tú' : `Si nadie del equipo escribe en ${h} horas`}
                    </option>
                  ))}
                </select>
                <span className="block text-[11px] text-slate-500 mt-1">Cuenta desde el último mensaje de una persona del equipo (o desde que el asistente lo pasó). Vuelve cuando el cliente escriba de nuevo.</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => save()} disabled={saving} className="h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
              </button>
              {dirty && !saving && <span className="text-[12px] font-semibold text-amber-700">Tienes cambios sin guardar: el asistente sigue usando lo anterior.</span>}
              <button onClick={() => setCfg({ ...DEFAULT_BOT, enabled: cfg.enabled })} className="text-xs text-slate-500 hover:text-slate-800">
                Restaurar texto de ejemplo
              </button>
            </div>
            {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
            <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3 space-y-1">
              <p>• Si respondes tú en un chat, el asistente se calla en esa conversación. Lo devuelves con “Devolver al asistente” en Mensajes{cfg.resumeAfterHours ? `, o vuelve solo si nadie escribe en ${cfg.resumeAfterHours} horas` : ''}.</p>
              <p>• Cuando pasa un chat a una persona, queda en “Esperan asesor” y “Sin responder” con una nota del motivo.</p>
              <p>• Sus mensajes salen marcados como “Asistente IA” en Mensajes.</p>
            </div>
          </div>

          {/* Simulator */}
          <div className="rounded-2xl border border-slate-200 flex flex-col min-h-[460px] max-h-[620px] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Probar el asistente</p>
                <p className="text-[11px] text-slate-500">Escribe como si fueras un cliente. No se envía nada por WhatsApp.</p>
              </div>
              {sim.length > 0 && (
                <button onClick={() => (setSim([]), setCost(0), setSimError(null))} className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
                </button>
              )}
            </div>
            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Opcional: celular de un cliente real para que consulte sus pedidos"
                className="flex-1 text-xs outline-none placeholder-slate-400"
              />
            </div>
            <div className="flex-1 overflow-y-auto bg-[#efeae2]/60 p-3 space-y-2">
              {sim.length === 0 && (
                <div className="text-center text-xs text-slate-500 mt-10 space-y-1.5">
                  <p>Prueba preguntas como:</p>
                  {['¿Cuánto cuesta?', 'Lo quiero, ¿cómo hago el pedido?', '¿Ya despacharon mi pedido?', 'Me llegó dañado, quiero hablar con alguien'].map((q) => (
                    <button key={q} onClick={() => setDraft(q)} className="block mx-auto px-3 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {sim.map((m, i) => (
                <div key={i} className={`flex ${m.direction === 'in' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] whitespace-pre-wrap shadow-sm ${m.direction === 'in' ? 'bg-[#d9fdd3] text-slate-800' : 'bg-white text-slate-800'}`}>
                    {m.direction === 'out' && <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 mb-0.5">{cfg.name} · IA</p>}
                    {m.text}
                    {m.notes?.map((n) => (
                      <p key={n} className="mt-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-1">
                        {n}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-3 py-2 bg-white text-xs text-slate-500 inline-flex items-center gap-1.5 shadow-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {cfg.name} está escribiendo…
                  </div>
                </div>
              )}
              {simError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{simError}</p>}
              <div ref={endRef} />
            </div>
            <div className="p-2.5 border-t border-slate-100 flex items-center gap-2">
              <UserRound className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendSim()}
                disabled={!configured}
                placeholder={configured ? 'Escribe como cliente…' : 'Agrega ANTHROPIC_API_KEY para probar'}
                className="flex-1 h-9 text-[13px] bg-slate-50 border border-slate-200 rounded-xl px-3 outline-none focus:bg-white"
              />
              <button onClick={sendSim} disabled={!draft.trim() || thinking || !configured} className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center disabled:opacity-40" aria-label="Enviar">
                <Send className="w-4 h-4" />
              </button>
            </div>
            {cost > 0 && <p className="px-4 pb-2 text-[10px] text-slate-400">Costo aproximado de esta prueba: US${cost.toFixed(4)} (precios de lista de Claude)</p>}
          </div>
        </div>
      )}
    </section>
  );
}

interface PriceRow {
  id: string;
  name: string;
  kind: 'landing' | 'product';
  offers: { name: string; units: number; price: number; regular: number | null }[];
}
const cop = (n: number) => `$${n.toLocaleString('es-CO')}`;

// The prices the assistant quotes and charges come from the products (landing offers / WhatsApp products), not from
// this text. Lists them, and warns about amounts in the text that no product has (an old price left in the text).
function PricesBox({ prices, text }: { prices: PriceRow[]; text: string }) {
  const known = new Set(prices.flatMap((p) => p.offers.flatMap((o) => [o.price, o.regular || 0])));
  const found = Array.from(text.matchAll(/\$\s*\d{1,3}(?:[.,]\d{3})+|\$\s*\d{4,}|\b\d{1,3}(?:\.\d{3})+\b/g))
    .map((m) => Number(m[0].replace(/[^\d]/g, '')))
    .filter((n) => n >= 1000);
  const unknown = Array.from(new Set(found.filter((n) => !known.has(n)))).slice(0, 6);
  if (!prices.length && !unknown.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
      <p className="text-[13px] font-semibold text-slate-900">💲 Precios que usa el asistente</p>
      <p className="text-[11px] text-slate-500">
        Salen de tus productos, no de este texto: son los que dice y los que cobra al tomar el pedido. Para cambiarlos, edita la oferta en{' '}
        <a href="/landings" className="underline">
          Landing pages
        </a>{' '}
        o en{' '}
        <a href="/productos" className="underline">
          Productos
        </a>
        . El cambio aplica al instante, también en chats donde ya había dado el precio anterior.
      </p>
      {prices.map((p) => (
        <p key={p.id} className="text-[12px] text-slate-700">
          <strong>{p.name}</strong>: {p.offers.map((o) => `${o.name} ${cop(o.price)}`).join(' · ')}
        </p>
      ))}
      {unknown.length > 0 && (
        <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          Tu información menciona {unknown.map(cop).join(', ')}, que no {unknown.length === 1 ? 'es el precio' : 'son precios'} de ningún producto. Si es un precio viejo, cámbialo en el producto: el asistente usará el del producto. Si es otra
          cosa (envío, por ejemplo), ignora este aviso.
        </p>
      )}
    </div>
  );
}
