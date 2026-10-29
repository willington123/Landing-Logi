'use client';

// WhatsApp automatic replies: answers by keyword and an out-of-hours message (stored in Supabase, sent by the webhook).
import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Clock, Loader2, MoonStar, Plus, Trash2 } from 'lucide-react';
import { TIMEZONES, type AutoSettings } from '@/lib/crm';
import { isCloud } from '@/lib/cloud';

interface RuleDraft {
  id: string;
  enabled: boolean;
  keywords: string; // comma separated while editing
  reply: string;
}

const DAYS = [
  { d: 1, l: 'L' },
  { d: 2, l: 'M' },
  { d: 3, l: 'X' },
  { d: 4, l: 'J' },
  { d: 5, l: 'V' },
  { d: 6, l: 'S' },
  { d: 0, l: 'D' },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export default function WhatsAppAutoReplies() {
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [cfg, setCfg] = useState<AutoSettings | null>(null);
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [workingNow, setWorkingNow] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = (s: AutoSettings, w: boolean) => {
    setCfg(s);
    setRules(s.rules.map((r) => ({ id: r.id, enabled: r.enabled, keywords: r.keywords.join(', '), reply: r.reply })));
    setWorkingNow(w);
  };

  useEffect(() => {
    isCloud().then((c) => {
      setCloud(c);
      if (!c) return;
      fetch('/api/whatsapp/auto', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => (d.success ? apply(d.settings, d.workingNow) : setError(d.error)))
        .catch((e) => setError(String(e?.message || e)));
    });
  }, []);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setMsg(null);
    try {
      const body = { settings: { ...cfg, rules: rules.map((r) => ({ id: r.id, enabled: r.enabled, keywords: r.keywords.split(','), reply: r.reply })) } };
      const res = await fetch('/api/whatsapp/auto', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      apply(d.settings, d.workingNow);
      setMsg({ ok: true, text: 'Guardado. Ya se aplica a los mensajes que lleguen.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
  if (cloud === false) return null;
  const away = cfg?.away;
  const setAway = (patch: Partial<AutoSettings['away']>) => cfg && setCfg({ ...cfg, away: { ...cfg.away, ...patch } });
  const setRule = (i: number, patch: Partial<RuleDraft>) => setRules((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <section id="whatsapp" className={`${card} p-5 md:p-6 space-y-5`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">Respuestas automáticas de WhatsApp</h2>
          <p className="text-[13px] text-slate-500">
            Contestan solas cuando un cliente escribe. Cada respuesta se envía como máximo una vez al día al mismo cliente, y el aviso de fuera de horario una vez cada 12 horas.
            Los chats siguen en “Sin responder” para que una persona los atienda.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">No se pudo cargar: {error}</p>}
      {!cfg && !error && <Loader2 className="w-5 h-5 animate-spin text-slate-300" />}

      {cfg && away && (
        <>
          {/* Out of hours */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <MoonStar className="w-4 h-4 text-indigo-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Mensaje fuera de horario</p>
                <p className="text-xs text-slate-500">Si escriben fuera de tu horario de atención, reciben este aviso.</p>
              </div>
              <Toggle on={away.enabled} onChange={(v) => setAway({ enabled: v })} label="Activar mensaje fuera de horario" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                {DAYS.map(({ d, l }) => {
                  const on = away.days.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => setAway({ days: on ? away.days.filter((x) => x !== d) : [...away.days, d] })}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
                      aria-pressed={on}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                de
                <input type="time" value={away.start} onChange={(e) => setAway({ start: e.target.value })} className="h-8 border border-slate-200 rounded-lg px-2 text-[13px]" />
                a
                <input type="time" value={away.end} onChange={(e) => setAway({ end: e.target.value })} className="h-8 border border-slate-200 rounded-lg px-2 text-[13px]" />
              </label>
              <select value={cfg.timezone} onChange={(e) => setCfg({ ...cfg, timezone: e.target.value })} className="h-8 border border-slate-200 rounded-lg px-2 text-xs bg-white" aria-label="Zona horaria">
                {TIMEZONES.map((t) => (
                  <option key={t.id} value={t.id}>
                    Hora de {t.label}
                  </option>
                ))}
              </select>
              {workingNow !== null && away.enabled && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${workingNow ? 'text-emerald-700' : 'text-indigo-700'}`}>
                  <Clock className="w-3 h-3" /> Ahora estás {workingNow ? 'en horario' : 'fuera de horario'} (según lo guardado)
                </span>
              )}
            </div>
            <textarea
              value={away.message}
              onChange={(e) => setAway({ message: e.target.value })}
              rows={3}
              maxLength={1000}
              className="w-full text-[13px] border border-slate-200 rounded-xl px-3 py-2"
              placeholder="Mensaje fuera de horario"
            />
          </div>

          {/* Keywords */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Por palabra clave</p>
              <p className="text-xs text-slate-500">
                Si el mensaje del cliente tiene alguna de las palabras (sin importar tildes ni mayúsculas), se responde con el texto. Puedes usar <code className="text-[11px]">{'{nombre}'}</code>.
                No se usan con los mensajes de confirmación de pedido.
              </p>
            </div>
            {rules.length === 0 && <p className="text-xs text-slate-400">No tienes respuestas por palabra clave.</p>}
            {rules.map((r, i) => (
              <div key={r.id || `new-${i}`} className={`rounded-xl border p-3 space-y-2 ${r.enabled ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <Toggle on={r.enabled} onChange={(v) => setRule(i, { enabled: v })} label="Activar respuesta" />
                  <input
                    value={r.keywords}
                    onChange={(e) => setRule(i, { keywords: e.target.value })}
                    placeholder="Palabras separadas por coma: precio, cuanto cuesta"
                    className="flex-1 h-9 text-[13px] border border-slate-200 rounded-lg px-3 bg-white"
                  />
                  <button onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-600" aria-label="Borrar respuesta">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={r.reply}
                  onChange={(e) => setRule(i, { reply: e.target.value })}
                  rows={2}
                  maxLength={1000}
                  placeholder="Respuesta"
                  className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2 bg-white"
                />
              </div>
            ))}
            <button
              onClick={() => setRules((prev) => [...prev, { id: '', enabled: true, keywords: '', reply: '' }])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar respuesta
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
            </button>
            {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
          </div>
        </>
      )}
    </section>
  );
}
