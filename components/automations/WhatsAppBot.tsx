'use client';

// AI assistant for WhatsApp (Claude): settings and a simulator to try it before turning it on.
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Search, Send, Sparkles, UserRound } from 'lucide-react';
import { DEFAULT_BOT, type BotSettings } from '@/lib/bot';
import { isCloud } from '@/lib/cloud';

interface SimMsg {
  direction: 'in' | 'out';
  text: string;
  notes?: string[]; // what the assistant did (tools)
}

// Claude Opus 5.5 list prices (USD per million tokens), for the cost shown in the simulator.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const usd = (u: { input: number; output: number; cacheRead: number; cacheWrite: number }) =>
  (u.input * PRICE.input + u.output * PRICE.output + u.cacheRead * PRICE.cacheRead + u.cacheWrite * PRICE.cacheWrite) / 1_000_000;

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
          setConfigured(d.configured);
        })
        .catch((e) => setLoadError(String(e?.message || e)));
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [sim, thinking]);

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
        if (t.name === 'pasar_a_humano') notes.push(`👤 Pasó el chat a una persona: ${t.input?.motivo || ''}`);
        if (t.name === 'crear_pedido')
          notes.push(
            t.result?.ok
              ? `🛒 Tomó el pedido: ${t.result.oferta} · ${t.result.total} · ${t.result.direccion} (simulación: no se creó)`
              : `📝 Faltaban datos: ${String(t.result?.error || '').replace(/ Pídeselos al cliente\.?/, '')}`,
          );
      }
      if (d.refused) notes.push('⚠️ El asistente no quiso responder este mensaje: pasaría a una persona.');
      setCost((c) => c + usd(d.usage));
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
    <section id="asistente" className={`${card} p-5 md:p-6 space-y-5`}>
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
            {cfg.mode === 'away' && <p className="text-[11px] text-slate-500">Usa el horario del “Mensaje fuera de horario” de abajo. En horario de atención responden las personas.</p>}
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Información del negocio</span>
              <span className="block text-[11px] text-slate-400">
                Envíos, pago, garantía, cambios, horarios… El asistente solo responde con esto y con lo que hay en tus landings publicadas (productos, ofertas y preguntas frecuentes).
              </span>
              <textarea value={cfg.businessInfo} onChange={(e) => set({ businessInfo: e.target.value })} rows={9} maxLength={6000} className="mt-1.5 w-full text-[13px] border border-slate-200 rounded-xl px-3 py-2" />
            </label>
            <div className="flex items-center gap-3">
              <button onClick={() => save()} disabled={saving} className="h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
              </button>
              <button onClick={() => setCfg({ ...DEFAULT_BOT, enabled: cfg.enabled })} className="text-xs text-slate-500 hover:text-slate-800">
                Restaurar texto de ejemplo
              </button>
            </div>
            {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
            <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3 space-y-1">
              <p>• Si respondes tú en un chat, el asistente se calla en esa conversación. Lo devuelves con “Devolver al asistente” en Mensajes.</p>
              <p>• Cuando pasa un chat a una persona, queda en “Sin responder” con una nota del motivo.</p>
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
