'use client';

// Comments on Facebook / Instagram posts and ads: connect pages, keyword rules (public reply + private message
// with the WhatsApp link), AI answers / hiding spam, a test box, counts and the latest comments.
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Facebook, Instagram, Loader2, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { SOCIAL_RECIPES, type SocialChannel, type SocialRule, type SocialSettings } from '@/lib/social';

interface Page {
  id: string;
  name: string;
  picture: string | null;
  ig: { id: string; username: string } | null;
  active: boolean;
}
interface Stats {
  comments: number;
  publicReplies: number;
  privateMessages: number;
  hidden: number;
  failed: number;
}
interface LogItem {
  at: string;
  channel: SocialChannel;
  account: string;
  who: string;
  text: string;
  rule: string | null;
  done: string[];
  error?: string;
  skipped?: string;
  adId?: string | null;
}
interface Data {
  available: boolean;
  connected: boolean;
  pages: Page[];
  whatsappNumber: string;
  settings: SocialSettings;
  log: LogItem[];
  stats: Record<string, Stats>;
  reached: Record<string, number>;
}

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const input = 'w-full h-10 text-[13px] border border-slate-200 rounded-lg px-3 bg-white';
const area = 'w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2 bg-white';
const label = 'text-xs font-medium text-slate-600';

async function call(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: 'no-store', ...init, headers: { 'content-type': 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Páginas conectadas. Ahora prende las que quieres que Konnexa atienda.' },
  no_pages: { ok: false, text: 'Facebook no devolvió páginas. Revisa que elegiste tus páginas al dar los permisos.' },
  cancelled: { ok: false, text: 'Cancelaste la conexión con Facebook.' },
  error: { ok: false, text: 'No se pudo conectar con Facebook. Intenta de nuevo.' },
  forbidden: { ok: false, text: 'Solo el dueño o un administrador pueden conectar las páginas.' },
  not_available: { ok: false, text: 'Falta configurar la app de Meta (META_APP_ID y META_APP_SECRET) en Vercel.' },
  invalid: { ok: false, text: 'La conexión venció. Vuelve a intentarlo.' },
};

function Switch({ on, onChange, label: l }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={l} onClick={() => onChange(!on)} className={`relative w-10 h-6 rounded-full transition shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}

function RuleEditor({ rule, onChange, onDelete }: { rule: SocialRule; onChange: (r: SocialRule) => void; onDelete: () => void }) {
  const set = (p: Partial<SocialRule>) => onChange({ ...rule, ...p });
  const toggleChannel = (c: SocialChannel) => set({ channels: rule.channels.includes(c) ? rule.channels.filter((x) => x !== c) : [...rule.channels, c] });
  return (
    <div className="space-y-3 pt-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Nombre</span>
          <input value={rule.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} className={`mt-1 ${input}`} />
        </label>
        <div>
          <span className={label}>Dónde</span>
          <div className="mt-1 flex gap-2">
            {(['facebook', 'instagram'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleChannel(c)}
                className={`h-10 px-3 rounded-lg border text-[13px] font-medium inline-flex items-center gap-1.5 ${rule.channels.includes(c) ? 'border-brand-blue bg-brand-blue/[0.06] text-brand-blue' : 'border-slate-200 text-slate-500'}`}
              >
                {c === 'facebook' ? <Facebook className="w-4 h-4" /> : <Instagram className="w-4 h-4" />} {c === 'facebook' ? 'Facebook' : 'Instagram'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="block">
        <span className={label}>Palabras clave (separadas por coma). Vacío = responde a todos los comentarios</span>
        <input defaultValue={rule.keywords.join(', ')} onChange={(e) => set({ keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })} className={`mt-1 ${input}`} placeholder="info, precio, lo quiero" />
      </label>
      <label className="block">
        <span className={label}>Solo en estas publicaciones o anuncios (enlaces o IDs, uno por línea). Vacío = todas</span>
        <textarea defaultValue={rule.postIds.join('\n')} rows={2} onChange={(e) => set({ postIds: e.target.value.split('\n').map((k) => k.trim()).filter(Boolean) })} className={`mt-1 ${area}`} placeholder="https://www.facebook.com/…/posts/123456789" />
      </label>
      <label className="block">
        <span className={label}>Respuesta pública (una por línea; Konnexa elige una al azar para que no se vea repetido). Usa {'{nombre}'}</span>
        <textarea value={rule.publicReplies.join('\n')} rows={3} onChange={(e) => set({ publicReplies: e.target.value.split('\n') })} className={`mt-1 ${area}`} />
      </label>
      <label className="block">
        <span className={label}>Mensaje privado (Messenger o Instagram Direct). Usa {'{nombre}'}</span>
        <textarea value={rule.dm} rows={3} maxLength={900} onChange={(e) => set({ dm: e.target.value })} className={`mt-1 ${area}`} />
      </label>
      <div className="rounded-lg bg-emerald-50/60 border border-emerald-200 p-3 space-y-2">
        <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          <Switch on={rule.whatsapp} onChange={(v) => set({ whatsapp: v })} label="Enlace a WhatsApp" /> Agregar el enlace para escribir por WhatsApp
        </label>
        {rule.whatsapp && (
          <label className="block">
            <span className={label}>Mensaje que ya aparece escrito al abrir WhatsApp</span>
            <input value={rule.waText} maxLength={200} onChange={(e) => set({ waText: e.target.value })} className={`mt-1 ${input}`} />
            <span className="text-[11px] text-slate-500">Con este texto Konnexa cuenta cuántas personas llegaron a WhatsApp desde esta regla.</span>
          </label>
        )}
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <Switch on={rule.enabled} onChange={(v) => set({ enabled: v })} label="Regla activa" /> {rule.enabled ? 'Activa' : 'Pausada'}
        </label>
        <button type="button" onClick={onDelete} className="text-[13px] text-red-600 inline-flex items-center gap-1">
          <Trash2 className="w-4 h-4" /> Borrar regla
        </button>
      </div>
    </div>
  );
}

export default function SocialComments() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [test, setTest] = useState({ text: 'Info por favor', channel: 'instagram' as SocialChannel });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [showLog, setShowLog] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const load = () =>
    call('/api/social')
      .then((d: Data) => {
        setData(d);
        setSettings(d.settings);
        setActive(new Set(d.pages.filter((p) => p.active).map((p) => p.id)));
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search).get('social');
    if (q && NOTICES[q]) setNotice(NOTICES[q]);
  }, []);

  const save = async () => {
    if (!settings || !data) return;
    setSaving(true);
    setNotice(null);
    try {
      // Pages are sent every time: saving also renews the subscription (comments and messages).
      const d = await call('/api/social', { method: 'PUT', body: JSON.stringify({ settings, activePages: Array.from(active) }) });
      setSettings(d.settings);
      const failed = (d.results || []).filter((r: any) => !r.ok);
      setNotice(failed.length ? { ok: false, text: `Guardado, pero no se pudieron prender ${failed.length} página(s): ${failed[0].error}` } : { ok: true, text: 'Guardado. Konnexa ya está atendiendo los comentarios.' });
      load();
    } catch (e: any) {
      setNotice({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Test with what's on screen (saved first, so the server uses these rules).
      if (settings) await call('/api/social', { method: 'PUT', body: JSON.stringify({ settings }) });
      const d = await call('/api/social', { method: 'POST', body: JSON.stringify({ ...test, name: 'Laura' }) });
      setTestResult(d.result);
    } catch (e: any) {
      setTestResult({ error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const addRule = (base?: Omit<SocialRule, 'id'>) => {
    if (!settings) return;
    const id = `r_${Date.now().toString(36)}`;
    const r: SocialRule = base
      ? { ...base, id, keywords: [...base.keywords], publicReplies: [...base.publicReplies], channels: [...base.channels], postIds: [] }
      : { id, name: 'Nueva regla', enabled: true, channels: ['facebook', 'instagram'], keywords: [], postIds: [], publicReplies: ['¡Hola {nombre}! Te escribimos al privado 📩'], dm: 'Hola {nombre} 👋', whatsapp: true, waText: 'Hola, vi su publicación y quiero información' };
    setSettings({ ...settings, rules: [...settings.rules, r] });
    setOpen(id);
  };

  return (
    <section id="comentarios" className={`${card} p-5 md:p-6 space-y-4 scroll-mt-20`}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-fuchsia-500 to-amber-400 text-white flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900">Comentarios de Facebook e Instagram</h2>
          <p className="text-[13px] text-slate-600">
            Cuando alguien comenta tu anuncio o publicación con una palabra clave, Konnexa le responde en público y le escribe al privado con el botón para seguir por WhatsApp.
          </p>
        </div>
      </div>

      {error && <p className="text-[13px] text-red-600">No se pudo cargar: {error}</p>}
      {!data && !error && <div className="h-24 rounded-xl bg-slate-50 animate-pulse" />}
      {notice && (
        <div className={`rounded-xl border p-3 text-[13px] flex gap-2 ${notice.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
          {notice.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{notice.text}</span>
        </div>
      )}

      {data && !data.connected && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-[13px] text-slate-700">Conecta tus páginas de Facebook. Si tienen una cuenta de Instagram profesional vinculada, también se conecta.</p>
          {data.available ? (
            <a href="/api/integrations/meta-pages/oauth" className="h-10 px-4 rounded-xl bg-[#1877F2] text-white text-sm font-semibold inline-flex items-center gap-2">
              <Facebook className="w-4 h-4" /> Conectar páginas de Facebook e Instagram
            </a>
          ) : (
            <p className="text-[12px] text-amber-800">Falta configurar la app de Meta (META_APP_ID y META_APP_SECRET) en Vercel.</p>
          )}
        </div>
      )}

      {data?.connected && settings && (
        <>
          {/* Pages */}
          <div>
            <p className="text-[13px] font-semibold text-slate-800 mb-2">Páginas que Konnexa atiende</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {data.pages.map((p) => (
                <li key={p.id} className="p-3 flex items-center gap-3">
                  {p.picture ? <img src={p.picture} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full bg-slate-100" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Facebook className="w-3 h-3" /> Facebook
                      {p.ig ? (
                        <>
                          {' '}
                          · <Instagram className="w-3 h-3" /> @{p.ig.username}
                        </>
                      ) : (
                        ' · sin Instagram vinculado'
                      )}
                    </p>
                  </div>
                  <Switch on={active.has(p.id)} onChange={(v) => setActive((s) => { const n = new Set(s); if (v) n.add(p.id); else n.delete(p.id); return n; })} label={`Atender ${p.name}`} />
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-3 text-[12px]">
              <a href="/api/integrations/meta-pages/oauth" className="font-semibold text-brand-blue">
                Volver a conectar (si agregaste páginas)
              </a>
              <button
                onClick={() => {
                  if (confirm('¿Desconectar tus páginas? Konnexa deja de atender los comentarios.')) call('/api/social', { method: 'DELETE' }).then(load).catch((e) => setNotice({ ok: false, text: e.message }));
                }}
                className="text-slate-500"
              >
                Desconectar
              </button>
            </div>
          </div>

          {/* Rules */}
          <div>
            <p className="text-[13px] font-semibold text-slate-800 mb-2">Reglas por palabra clave</p>
            {!settings.rules.some((r) => r.enabled) && (
              <p className="mb-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[12px] text-amber-900">
                No tienes reglas activas: nadie recibe el mensaje privado por palabra clave. Toca una de las ideas de abajo y dale <b>Guardar</b>.
              </p>
            )}
            {settings.rules.length > 0 && (
              <ul className="space-y-2">
                {settings.rules.map((r, i) => {
                  const s = data.stats[r.id];
                  return (
                    <li key={r.id} className="rounded-xl border border-slate-200 p-3">
                      <button className="w-full text-left flex items-start gap-2" onClick={() => setOpen(open === r.id ? null : r.id)}>
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${r.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-slate-900">{r.name}</span>
                          <span className="block text-[12px] text-slate-600">
                            {r.keywords.length ? `Comentan "${r.keywords.slice(0, 4).join('", "')}"` : 'Cualquier comentario'} en {r.channels.map((c) => (c === 'facebook' ? 'Facebook' : 'Instagram')).join(' e ')}
                            {r.postIds.length ? ` (${r.postIds.length} publicaciones)` : ''} → {[r.publicReplies.filter(Boolean).length ? 'responde en público' : '', r.dm || r.whatsapp ? 'escribe al privado' : '', r.whatsapp ? 'con enlace a WhatsApp' : ''].filter(Boolean).join(', ')}
                          </span>
                          {s && (
                            <span className="block text-[11px] text-slate-500 mt-0.5">
                              {s.comments} comentarios · {s.privateMessages} privados{r.whatsapp ? ` · ${data.reached[r.id] || 0} llegaron a WhatsApp (30 días)` : ''}
                              {s.failed ? ` · ${s.failed} con error` : ''}
                            </span>
                          )}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${open === r.id ? 'rotate-180' : ''}`} />
                      </button>
                      {open === r.id && (
                        <RuleEditor
                          rule={r}
                          onChange={(x) => setSettings({ ...settings, rules: settings.rules.map((y, j) => (j === i ? x : y)) })}
                          onDelete={() => setSettings({ ...settings, rules: settings.rules.filter((_, j) => j !== i) })}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-2 grid sm:grid-cols-3 gap-2">
              {SOCIAL_RECIPES.map((x) => (
                <button key={x.title} onClick={() => addRule(x.rule)} className="text-left rounded-xl border border-slate-200 p-3 hover:border-brand-blue hover:bg-brand-blue/[0.03] transition">
                  <p className="text-[13px] font-semibold text-slate-900">{x.title}</p>
                  <p className="text-[12px] text-slate-600 mt-0.5">{x.hint}</p>
                </button>
              ))}
            </div>
            <button onClick={() => addRule()} className="mt-2 text-[13px] font-semibold text-brand-blue inline-flex items-center gap-1">
              <Plus className="w-4 h-4" /> Regla en blanco
            </button>
          </div>

          {/* WhatsApp number + AI */}
          <div className="grid lg:grid-cols-2 gap-3">
            <label className="block rounded-xl border border-slate-200 p-3">
              <span className={label}>Número de WhatsApp para el enlace</span>
              <input
                value={settings.waNumber}
                inputMode="tel"
                onChange={(e) => setSettings({ ...settings, waNumber: e.target.value.replace(/\D/g, '') })}
                className={`mt-1 ${input}`}
                placeholder={data.whatsappNumber ? `${data.whatsappNumber} (el conectado)` : '573001234567'}
              />
              <span className="text-[11px] text-slate-500">Con indicativo del país, sin + ni espacios. Vacío = el número de WhatsApp conectado.</span>
            </label>
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
              <p className="text-[13px] font-semibold text-slate-900">Con inteligencia artificial (comentarios sin palabra clave)</p>
              <label className="flex items-start gap-2 text-[12px] text-slate-700">
                <Switch on={settings.ai.answer} onChange={(v) => setSettings({ ...settings, ai: { ...settings.ai, answer: v } })} label="Responder preguntas" />
                <span>Responder en público preguntas como “¿hacen envíos a Cali?” con la información de tus landings.</span>
              </label>
              <label className="flex items-start gap-2 text-[12px] text-slate-700">
                <Switch on={settings.ai.hide} onChange={(v) => setSettings({ ...settings, ai: { ...settings.ai, hide: v } })} label="Ocultar spam" />
                <span>Ocultar insultos, spam y estafas (quedan ocultos para los demás, no se borran).</span>
              </label>
              <label className={`flex items-start gap-2 text-[12px] ${settings.ai.answer || settings.ai.hide ? 'text-slate-700' : 'text-slate-400'}`}>
                <Switch on={settings.ai.dm} onChange={(v) => setSettings({ ...settings, ai: { ...settings.ai, dm: v } })} label="Escribir al privado a interesados" />
                <span>Si la persona muestra interés (pide info, precio, cómo comprar), escribirle también al privado con el enlace a WhatsApp.</span>
              </label>
              {settings.ai.dm && (settings.ai.answer || settings.ai.hide) && (
                <textarea
                  value={settings.ai.dmText}
                  rows={2}
                  maxLength={900}
                  onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, dmText: e.target.value } })}
                  className="w-full text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                  aria-label="Mensaje privado de la IA"
                />
              )}
              <p className="text-[11px] text-slate-500">Cada comentario revisado por la IA cuenta como una respuesta de IA de tu plan.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="h-10 px-5 rounded-xl bg-brand-gradient text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
            </button>
          </div>

          {/* Test */}
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-[13px] font-semibold text-slate-800">Probar un comentario (no publica nada)</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={test.text} onChange={(e) => setTest({ ...test, text: e.target.value })} className={input} placeholder="Escribe un comentario" />
              <select value={test.channel} onChange={(e) => setTest({ ...test, channel: e.target.value as SocialChannel })} className="h-10 text-[13px] border border-slate-200 rounded-lg px-2 bg-white">
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
              <button onClick={runTest} disabled={testing} className="h-10 px-4 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1.5 justify-center">
                {testing && <Loader2 className="w-4 h-4 animate-spin" />} Probar
              </button>
            </div>
            {testResult && (
              <div className="text-[12px] text-slate-700 bg-slate-50 rounded-lg p-3 space-y-1.5 whitespace-pre-wrap">
                {testResult.error ? (
                  <p className="text-red-600">{testResult.error}</p>
                ) : (
                  <>
                    <p>
                      <b>Regla:</b> {testResult.rule || (testResult.ai ? `ninguna → la IA decidió: ${({ responder: 'responder', ocultar: 'ocultar', ignorar: 'dejarlo', privado: 'escribirle al privado' } as Record<string, string>)[testResult.ai] || testResult.ai}` : 'ninguna (no se hace nada)')}
                    </p>
                    {testResult.publicReply && (
                      <p>
                        <b>Respuesta pública:</b> {testResult.publicReply}
                      </p>
                    )}
                    {testResult.privateMessage && (
                      <p>
                        <b>Mensaje privado:</b> {testResult.privateMessage}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Latest comments */}
          {data.log.length > 0 && (
            <div>
              <button onClick={() => setShowLog((v) => !v)} className="text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1">
                <ChevronDown className={`w-4 h-4 transition ${showLog ? 'rotate-180' : ''}`} /> Últimos comentarios ({data.log.length})
              </button>
              {showLog && (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-[12px]">
                  {data.log.map((l, i) => (
                    <li key={i} className="px-3 py-2">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        {l.channel === 'instagram' ? <Instagram className="w-3.5 h-3.5" /> : <Facebook className="w-3.5 h-3.5" />} {l.account} · {l.who}
                        {l.adId ? ' · anuncio' : ''}
                        <span className="ml-auto">{new Date(l.at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-800">“{l.text}”</p>
                      <p className={l.error ? 'text-amber-800' : 'text-slate-600'}>
                        {l.skipped || [l.rule ? `Regla: ${l.rule}` : '', l.done.join(' + '), l.error ? `Error: ${l.error}` : ''].filter(Boolean).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <div>
        <button onClick={() => setShowSetup((v) => !v)} className="text-[12px] font-medium text-slate-500 inline-flex items-center gap-1">
          <ChevronDown className={`w-3.5 h-3.5 transition ${showSetup ? 'rotate-180' : ''}`} /> Configuración de la app de Meta (una sola vez, para el dueño de Konnexa)
        </button>
        {showSetup && (
          <ol className="mt-2 list-decimal pl-5 text-[12px] text-slate-600 space-y-1">
            <li>En developers.facebook.com → tu app → Webhooks: elige “Page”, URL de devolución <code>{typeof window !== 'undefined' ? window.location.origin : ''}/api/meta/webhook</code>, el mismo token de verificación de WhatsApp, y suscribe los campos “feed” y “messages”.</li>
            <li>En el mismo lugar elige “Instagram” con la misma URL y suscribe los campos “comments” y “messages”.</li>
            <li>En Inicio de sesión con Facebook → Configuración, agrega la URL de redirección <code>{typeof window !== 'undefined' ? window.location.origin : ''}/api/integrations/meta-pages/oauth/callback</code>.</li>
            <li>Agrega los permisos pages_manage_engagement, pages_messaging, pages_manage_metadata, pages_read_engagement, pages_read_user_content, instagram_basic, instagram_manage_comments e instagram_manage_messages. Con tus propias páginas funcionan ya; para tus clientes van en la revisión de la app.</li>
          </ol>
        )}
      </div>
    </section>
  );
}
