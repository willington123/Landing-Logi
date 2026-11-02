'use client';

// "Mis flujos": the store's own automations (when X → if … → wait → do Y), with recipes, a test button and the run log.
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Pencil, Play, Plus, Trash2, X, XCircle, Zap } from 'lucide-react';
import {
  ACTIONS,
  APPT_STATUS_OPTIONS,
  CONDITION_FIELDS,
  IDLE_HOURS,
  ORDER_STATUS_OPTIONS,
  RECIPES,
  TRIGGERS,
  VARIABLES,
  WAIT_OPTIONS,
  statusLabel,
  type Flow,
  type FlowAction,
  type FlowCondition,
  type FlowLogItem,
  type FlowStats,
  type FlowTrigger,
} from '@/lib/flows';

interface Data {
  flows: Flow[];
  stats: Record<string, FlowStats>;
  log: FlowLogItem[];
  pending: Record<string, number>;
  businessType: 'orders' | 'appointments';
  builtIn: { whatsapp: boolean; confirmOnOrder: boolean; autoCall: boolean; followUp: boolean };
}
interface Template {
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
  vars: number;
}
interface Named {
  id: string;
  name: string;
}

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const input = 'w-full h-10 text-[13px] border border-slate-200 rounded-lg px-3 bg-white';
const label = 'text-xs font-medium text-slate-600';

async function call(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: 'no-store', ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

const waitLabel = (m: number) => WAIT_OPTIONS.find((w) => w.minutes === m)?.label || `${m} min`;

function triggerText(t: FlowTrigger): string {
  switch (t.type) {
    case 'order_created':
      return 'Entra un pedido';
    case 'order_status':
      return `Un pedido pasa a ${statusLabel(t.status)}`;
    case 'appointment_created':
      return 'Se agenda una cita';
    case 'appointment_status':
      return `Una cita pasa a ${statusLabel(t.status)}`;
    case 'message_keyword':
      return `Un cliente escribe "${t.keywords.join('", "')}"`;
    case 'chat_idle':
      return `Un cliente lleva ${t.hours} h sin responder`;
  }
}

function actionText(a: FlowAction, tags: Named[], agents: Named[]): string {
  switch (a.type) {
    case 'send_template':
      return `Plantilla "${a.template || '¿cuál?'}"`;
    case 'send_text':
      return 'Mensaje de texto';
    case 'ai_call':
      return 'Llamar con IA';
    case 'set_status':
      return `Estado → ${statusLabel(a.status)}`;
    case 'tag_chat':
      return `Etiqueta "${tags.find((t) => t.id === a.tagId)?.name || '¿cuál?'}"`;
    case 'assign_chat':
      return `Asignar a ${agents.find((t) => t.id === a.agentId)?.name || '¿quién?'}`;
    case 'notify_team':
      return 'Correo al equipo';
    case 'webhook':
      return 'Enviar a otra app';
  }
}

function conditionText(c: FlowCondition): string {
  const f = CONDITION_FIELDS.find((x) => x.id === c.field);
  const v = f?.kind === 'status' ? statusLabel(c.value) : f?.kind === 'bool' ? (c.value === 'si' ? 'sí' : 'no') : f?.kind === 'number' ? `$${Number(c.value).toLocaleString('es-CO')}` : `"${c.value}"`;
  const op = { is: 'es', is_not: 'no es', gt: 'es mayor que', lt: 'es menor que', contains: 'contiene' }[c.op];
  return `${f?.label || c.field} ${op} ${v}`;
}

function defaultAction(type: FlowAction['type']): FlowAction {
  switch (type) {
    case 'send_template':
      return { type, template: '', lang: 'es', vars: [] };
    case 'send_text':
      return { type, text: 'Hola {nombre}, ' };
    case 'set_status':
      return { type, status: 'confirmed_by_voice' };
    case 'tag_chat':
      return { type, tagId: '' };
    case 'assign_chat':
      return { type, agentId: '' };
    case 'notify_team':
      return { type, text: '{nombre} ({telefono}) · pedido {pedido} · {total}' };
    case 'webhook':
      return { type, url: '' };
    default:
      return { type: 'ai_call' };
  }
}

function defaultTrigger(type: FlowTrigger['type']): FlowTrigger {
  switch (type) {
    case 'order_status':
      return { type, status: 'shipped' };
    case 'appointment_status':
      return { type, status: 'cancelled' };
    case 'message_keyword':
      return { type, keywords: [] };
    case 'chat_idle':
      return { type, hours: 3 };
    default:
      return { type } as FlowTrigger;
  }
}

// What the store should know before saving: costs and doubles with what's already automatic.
function warnings(f: Flow, d: Data): string[] {
  const out: string[] = [];
  const has = (t: FlowAction['type']) => f.actions.some((a) => a.type === t);
  if (has('send_template')) out.push('Cada plantilla que se envía tiene costo en WhatsApp (las de marketing cuestan más que las de utilidad).');
  if (has('send_template') || has('send_text')) if (!d.builtIn.whatsapp) out.push('Tu WhatsApp no está conectado: los mensajes no van a salir.');
  if (f.trigger.type === 'order_created' && f.waitMinutes === 0 && has('send_template') && d.builtIn.confirmOnOrder)
    out.push('Ya se envía la plantilla de confirmación con cada pedido: el cliente recibiría dos mensajes al tiempo.');
  if (f.trigger.type === 'order_created' && has('ai_call') && d.builtIn.autoCall) out.push('La llamada IA automática ya está prendida para cada pedido: lo llamarían dos veces.');
  if (f.trigger.type === 'chat_idle' && (has('send_text') || has('send_template')) && d.builtIn.followUp)
    out.push('El seguimiento del asistente ya le escribe a quien deja de responder: podría recibir dos mensajes.');
  if (has('send_text') && f.waitMinutes >= 1440) out.push('Un mensaje de texto solo sale si el cliente escribió en las últimas 24 h. Con esta espera, usa una plantilla.');
  if (f.trigger.type === 'order_status' && f.trigger.status === 'shipped' && f.actions.some((a) => a.type === 'send_template' && a.vars.some((v) => v.includes('{guia}'))))
    out.push('Para que salga la guía, escríbela al marcar el pedido como enviado.');
  return out;
}

function VarChips({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {VARIABLES.map((v) => (
        <button key={v.token} type="button" title={v.label} onClick={() => onPick(v.token)} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-mono">
          {v.token}
        </button>
      ))}
    </div>
  );
}

function Editor({
  initial,
  data,
  templates,
  templatesError,
  tags,
  agents,
  onCancel,
  onSave,
}: {
  initial: Flow;
  data: Data;
  templates: Template[];
  templatesError: string | null;
  tags: Named[];
  agents: Named[];
  onCancel: () => void;
  onSave: (f: Flow) => Promise<void>;
}) {
  const [f, setF] = useState<Flow>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const biz = data.businessType;
  const set = (p: Partial<Flow>) => setF((x) => ({ ...x, ...p }));
  const setAction = (i: number, a: FlowAction) => set({ actions: f.actions.map((x, j) => (j === i ? a : x)) });
  const setCond = (i: number, c: FlowCondition) => set({ conditions: f.conditions.map((x, j) => (j === i ? c : x)) });
  const triggers = TRIGGERS.filter((t) => t.business === 'both' || t.business === biz);
  const fields = CONDITION_FIELDS.filter((c) => c.business === 'both' || c.business === biz);
  const isAppt = f.trigger.type.startsWith('appointment');
  const actions = ACTIONS.filter((a) => !(isAppt && a.needsOrder));
  const statusOptions = isAppt ? APPT_STATUS_OPTIONS : ORDER_STATUS_OPTIONS;
  const warn = warnings(f, data);
  const approved = templates.filter((t) => t.status === 'APPROVED');

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(f);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 flex sm:items-center justify-center sm:p-4" onClick={onCancel}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{initial.id ? 'Editar flujo' : 'Nuevo flujo'}</h3>
          <button onClick={onCancel} className="hit w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <label className="block">
            <span className={label}>Nombre</span>
            <input value={f.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} className={`mt-1 ${input}`} placeholder="Ej: Aviso de envío" />
          </label>

          {/* 1. When */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-[13px] font-bold text-slate-900">1. Cuando…</p>
            <select value={f.trigger.type} onChange={(e) => set({ trigger: defaultTrigger(e.target.value as FlowTrigger['type']) })} className={input}>
              {triggers.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
            {(f.trigger.type === 'order_status' || f.trigger.type === 'appointment_status') && (
              <label className="block">
                <span className={label}>Pasa a</span>
                <select value={f.trigger.status} onChange={(e) => set({ trigger: { ...f.trigger, status: e.target.value } as FlowTrigger })} className={`mt-1 ${input}`}>
                  {statusOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {f.trigger.type === 'message_keyword' && (
              <label className="block">
                <span className={label}>Palabras clave (separadas por coma)</span>
                <input
                  defaultValue={f.trigger.keywords.join(', ')}
                  onChange={(e) => set({ trigger: { type: 'message_keyword', keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) } })}
                  className={`mt-1 ${input}`}
                  placeholder="garantía, devolución, mayorista"
                />
              </label>
            )}
            {f.trigger.type === 'chat_idle' && (
              <label className="block">
                <span className={label}>Horas sin responder (después de nuestro último mensaje)</span>
                <select value={f.trigger.hours} onChange={(e) => set({ trigger: { type: 'chat_idle', hours: Number(e.target.value) } })} className={`mt-1 ${input}`}>
                  {IDLE_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h} h
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* 2. Wait */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-[13px] font-bold text-slate-900">2. Esperar</p>
            <select value={f.waitMinutes} onChange={(e) => set({ waitMinutes: Number(e.target.value) })} className={input}>
              {WAIT_OPTIONS.map((w) => (
                <option key={w.minutes} value={w.minutes}>
                  {w.label}
                </option>
              ))}
            </select>
            {f.waitMinutes > 0 && <p className="text-[11px] text-slate-500">Las condiciones se revisan al terminar la espera, con los datos de ese momento.</p>}
          </div>

          {/* 3. Only if */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-[13px] font-bold text-slate-900">3. Solo si… <span className="font-normal text-slate-500">(opcional)</span></p>
            {f.conditions.map((c, i) => {
              const fd = fields.find((x) => x.id === c.field) || fields[0];
              return (
                <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_1fr_auto] gap-2 items-center">
                  <select value={c.field} onChange={(e) => setCond(i, { field: e.target.value as FlowCondition['field'], op: 'is', value: '' })} className={input}>
                    {fields.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => set({ conditions: f.conditions.filter((_, j) => j !== i) })} className="hit w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center sm:order-last" aria-label="Quitar condición">
                    <Trash2 className="w-4 h-4 text-slate-500" />
                  </button>
                  <select value={c.op} onChange={(e) => setCond(i, { ...c, op: e.target.value as FlowCondition['op'] })} className={input}>
                    {(fd.kind === 'number' ? (['gt', 'lt', 'is'] as const) : fd.kind === 'text' ? (['is', 'is_not', 'contains'] as const) : (['is', 'is_not'] as const)).map((o) => (
                      <option key={o} value={o}>
                        {{ is: 'es', is_not: 'no es', gt: 'mayor que', lt: 'menor que', contains: 'contiene' }[o]}
                      </option>
                    ))}
                  </select>
                  {fd.kind === 'status' ? (
                    <select value={c.value} onChange={(e) => setCond(i, { ...c, value: e.target.value })} className={input}>
                      <option value="">Elige…</option>
                      {statusOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : fd.kind === 'bool' ? (
                    <select value={c.value} onChange={(e) => setCond(i, { ...c, value: e.target.value })} className={input}>
                      <option value="">Elige…</option>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  ) : (
                    <input value={c.value} inputMode={fd.kind === 'number' ? 'numeric' : undefined} onChange={(e) => setCond(i, { ...c, value: e.target.value })} className={input} placeholder={fd.kind === 'number' ? '300000' : 'Medellín'} />
                  )}
                </div>
              );
            })}
            {f.conditions.length < 5 && (
              <button type="button" onClick={() => set({ conditions: [...f.conditions, { field: fields[0].id, op: 'is', value: '' }] })} className="text-[13px] font-semibold text-brand-blue inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> Agregar condición
              </button>
            )}
          </div>

          {/* 4. Do */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-[13px] font-bold text-slate-900">4. Hacer…</p>
            {f.actions.map((a, i) => {
              const tpl = a.type === 'send_template' ? templates.find((t) => t.name === a.template) : undefined;
              return (
                <div key={i} className="rounded-lg bg-slate-50 p-3 space-y-2">
                  <div className="flex gap-2">
                    <select value={a.type} onChange={(e) => setAction(i, defaultAction(e.target.value as FlowAction['type']))} className={input}>
                      {actions.map((x) => (
                        <option key={x.type} value={x.type}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => set({ actions: f.actions.filter((_, j) => j !== i) })} className="hit w-10 h-10 shrink-0 rounded-lg hover:bg-slate-200 flex items-center justify-center" aria-label="Quitar acción">
                      <Trash2 className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                  {a.type === 'send_template' && (
                    <>
                      {templatesError ? (
                        <p className="text-[12px] text-amber-800">No se pudieron cargar tus plantillas: {templatesError}</p>
                      ) : (
                        <select
                          value={a.template}
                          onChange={(e) => {
                            const t = templates.find((x) => x.name === e.target.value);
                            setAction(i, { ...a, template: e.target.value, lang: t?.language || 'es', vars: Array.from({ length: t?.vars || 0 }, (_, k) => a.vars[k] || '') });
                          }}
                          className={input}
                        >
                          <option value="">Elige una plantilla aprobada…</option>
                          {approved.map((t) => (
                            <option key={`${t.name}-${t.language}`} value={t.name}>
                              {t.name} ({t.category === 'MARKETING' ? 'marketing' : 'utilidad'})
                            </option>
                          ))}
                        </select>
                      )}
                      {!templatesError && !approved.length && <p className="text-[12px] text-slate-500">No tienes plantillas aprobadas. Créalas en Plantillas y espera la aprobación de Meta.</p>}
                      {tpl && <p className="text-[12px] text-slate-600 bg-white rounded-lg border border-slate-200 p-2 whitespace-pre-wrap">{tpl.body}</p>}
                      {a.vars.map((v, k) => (
                        <label key={k} className="block">
                          <span className={label}>{`Variable {{${k + 1}}}`}</span>
                          <input value={v} onChange={(e) => setAction(i, { ...a, vars: a.vars.map((x, j) => (j === k ? e.target.value : x)) })} className={`mt-1 ${input}`} />
                          <VarChips onPick={(t) => setAction(i, { ...a, vars: a.vars.map((x, j) => (j === k ? `${x}${t}` : x)) })} />
                        </label>
                      ))}
                    </>
                  )}
                  {(a.type === 'send_text' || a.type === 'notify_team') && (
                    <div>
                      <textarea value={a.text} rows={3} maxLength={2000} onChange={(e) => setAction(i, { ...a, text: e.target.value })} className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2 bg-white" />
                      <VarChips onPick={(t) => setAction(i, { ...a, text: `${a.text}${t}` })} />
                    </div>
                  )}
                  {a.type === 'set_status' && (
                    <select value={a.status} onChange={(e) => setAction(i, { ...a, status: e.target.value as any })} className={input}>
                      {ORDER_STATUS_OPTIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {a.type === 'tag_chat' && (
                    <select value={a.tagId} onChange={(e) => setAction(i, { ...a, tagId: e.target.value })} className={input}>
                      <option value="">{tags.length ? 'Elige la etiqueta…' : 'No tienes etiquetas: créalas en Mensajes'}</option>
                      {tags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {a.type === 'assign_chat' && (
                    <select value={a.agentId} onChange={(e) => setAction(i, { ...a, agentId: e.target.value })} className={input}>
                      <option value="">{agents.length ? 'Elige el asesor…' : 'No tienes asesores: agrégalos en Mensajes'}</option>
                      {agents.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {a.type === 'webhook' && (
                    <div>
                      <input value={a.url} onChange={(e) => setAction(i, { ...a, url: e.target.value })} className={input} placeholder="https://hook.us1.make.com/…" />
                      <p className="text-[11px] text-slate-500 mt-1">Pega la dirección del webhook de Make, Zapier o n8n. Le llegan el cliente, el pedido o la cita en JSON.</p>
                    </div>
                  )}
                  {a.type === 'ai_call' && <p className="text-[11px] text-slate-500">Llama al cliente para confirmar el pedido, aunque la llamada automática esté apagada.</p>}
                </div>
              );
            })}
            {f.actions.length < 5 && (
              <button type="button" onClick={() => set({ actions: [...f.actions, defaultAction('notify_team')] })} className="text-[13px] font-semibold text-brand-blue inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> Agregar acción
              </button>
            )}
          </div>

          {warn.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
              {warn.map((w) => (
                <p key={w} className="text-[12px] text-amber-900 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> {w}
                </p>
              ))}
            </div>
          )}
          {error && <p className="text-[13px] text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={onCancel} className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="h-10 px-5 rounded-xl bg-brand-gradient text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar flujo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyFlows() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [tags, setTags] = useState<Named[]>([]);
  const [agents, setAgents] = useState<Named[]>([]);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [showLog, setShowLog] = useState(false);

  const load = () =>
    call('/api/flows')
      .then((d) => setData(d))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    call('/api/integrations/whatsapp/templates')
      .then((d) =>
        setTemplates(
          (d.templates || []).map((t: any) => {
            const body = String((t.components || []).find((c: any) => c.type === 'BODY')?.text || '');
            const vars = Array.from(new Set((body.match(/\{\{\d+\}\}/g) || []) as string[])).length;
            return { name: t.name, language: t.language, status: t.status, category: t.category, body, vars };
          }),
        ),
      )
      .catch((e) => setTemplatesError(e.message));
    call('/api/whatsapp/tags').then((d) => setTags(d.items || [])).catch(() => {});
    call('/api/whatsapp/agents').then((d) => setAgents(d.items || [])).catch(() => {});
  }, []);

  const saveAll = async (flows: Flow[]) => {
    const d = await call('/api/flows', { method: 'PUT', body: JSON.stringify({ flows }) });
    setData((x) => (x ? { ...x, flows: d.flows } : x));
  };

  const recipes = useMemo(() => RECIPES.filter((r) => r.business === data?.businessType), [data?.businessType]);

  const newFlow = (base?: (typeof RECIPES)[number]['flow']): Flow => ({
    id: '',
    name: base?.name || '',
    enabled: true,
    trigger: base?.trigger || { type: data?.businessType === 'appointments' ? 'appointment_created' : 'order_created' },
    conditions: base?.conditions ? base.conditions.map((c) => ({ ...c })) : [],
    waitMinutes: base?.waitMinutes || 0,
    actions: base?.actions ? base.actions.map((a) => ({ ...a, ...(a.type === 'send_template' ? { vars: [...a.vars] } : {}) }) as FlowAction) : [defaultAction('notify_team')],
    createdAt: '',
  });

  const onSave = async (f: Flow) => {
    if (!data) return;
    const exists = f.id && data.flows.some((x) => x.id === f.id);
    await saveAll(exists ? data.flows.map((x) => (x.id === f.id ? f : x)) : [...data.flows, f]);
    setEditing(null);
    setNotice({ ok: true, text: `Flujo "${f.name}" guardado.` });
  };

  const test = async (f: Flow) => {
    setBusy(f.id);
    setNotice(null);
    try {
      const d = await call('/api/flows', { method: 'POST', body: JSON.stringify({ flow: f }) });
      const r: FlowLogItem = d.result;
      const text = r.skipped
        ? `Prueba con ${r.subject || 'el último registro'}: ${r.skipped}`
        : `Prueba con ${r.subject}: ${r.steps.map((s) => `${s.action} ${s.ok ? '✓' : `✗ (${s.error})`}`).join(' · ')}`;
      setNotice({ ok: r.ok && !r.skipped, text });
      load();
    } catch (e: any) {
      setNotice({ ok: false, text: e.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="flujos" className={`${card} p-5 md:p-6 space-y-4 scroll-mt-20`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900">Mis flujos</h2>
          <p className="text-[13px] text-slate-600">Arma tus propias automatizaciones: cuando pasa algo, Konnexa espera si quieres, revisa tus condiciones y hace lo que le digas.</p>
        </div>
        <button onClick={() => setEditing(newFlow())} disabled={!data} className="h-10 px-4 rounded-xl bg-brand-gradient text-white text-sm font-semibold inline-flex items-center gap-2 self-start shrink-0">
          <Plus className="w-4 h-4" /> Nuevo flujo
        </button>
      </div>

      {error && <p className="text-[13px] text-red-600">No se pudo cargar: {error}</p>}
      {!data && !error && <div className="h-24 rounded-xl bg-slate-50 animate-pulse" />}
      {notice && (
        <div className={`rounded-xl border p-3 text-[13px] flex gap-2 ${notice.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
          {notice.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {data && (
        <>
          {data.flows.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {data.flows.map((f) => {
                const s = data.stats[f.id];
                const pending = data.pending[f.id] || 0;
                return (
                  <li key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={f.enabled}
                        aria-label={f.enabled ? 'Apagar flujo' : 'Prender flujo'}
                        onClick={() => saveAll(data.flows.map((x) => (x.id === f.id ? { ...x, enabled: !x.enabled } : x))).catch((e) => setNotice({ ok: false, text: e.message }))}
                        className={`relative w-11 h-6 rounded-full transition shrink-0 mt-0.5 ${f.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${f.enabled ? 'translate-x-5' : ''}`} />
                      </button>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-slate-900">{f.name}</p>
                        <p className="text-[12px] text-slate-600">
                          {triggerText(f.trigger)}
                          {f.waitMinutes > 0 ? ` → espera ${waitLabel(f.waitMinutes)}` : ''}
                          {f.conditions.length ? ` → si ${f.conditions.map(conditionText).join(' y ')}` : ''} → {f.actions.map((a) => actionText(a, tags, agents)).join(' + ')}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {s ? `${s.runs} ${s.runs === 1 ? 'vez' : 'veces'}${s.failed ? ` · ${s.failed} con error` : ''}` : 'Todavía no ha corrido'}
                          {pending ? ` · ${pending} esperando` : ''}
                        </p>
                        {s?.lastError && <p className="text-[11px] text-amber-800 mt-0.5">Último error: {s.lastError}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 sm:shrink-0">
                      <button onClick={() => test(f)} disabled={busy === f.id} className="hit h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50">
                        {busy === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Probar
                      </button>
                      <button onClick={() => setEditing(f)} className="hit h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50">
                        <Pencil className="w-4 h-4" /> Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Borrar el flujo "${f.name}"?`)) saveAll(data.flows.filter((x) => x.id !== f.id)).catch((e) => setNotice({ ok: false, text: e.message }));
                        }}
                        className="hit h-9 w-9 rounded-lg border border-slate-200 inline-flex items-center justify-center hover:bg-slate-50"
                        aria-label="Borrar flujo"
                      >
                        <Trash2 className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div>
            <p className="text-[13px] font-semibold text-slate-800 mb-2">{data.flows.length ? 'Más ideas para empezar' : 'Empieza con una idea lista'}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {recipes.map((r) => (
                <button key={r.id} onClick={() => setEditing(newFlow(r.flow))} className="text-left rounded-xl border border-slate-200 p-3 hover:border-brand-blue hover:bg-brand-blue/[0.03] transition">
                  <p className="text-[13px] font-semibold text-slate-900">{r.title}</p>
                  <p className="text-[12px] text-slate-600 mt-0.5">{r.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {data.log.length > 0 && (
            <div>
              <button onClick={() => setShowLog((v) => !v)} className="text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1">
                <ChevronDown className={`w-4 h-4 transition ${showLog ? 'rotate-180' : ''}`} /> Últimas ejecuciones ({data.log.length})
              </button>
              {showLog && (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-[12px]">
                  {data.log.slice(0, 30).map((l, i) => (
                    <li key={i} className="px-3 py-2 flex gap-2">
                      {l.skipped ? <span className="w-4 h-4 shrink-0 text-slate-400">–</span> : l.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                      <span className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-800">{l.flowName}</span> <span className="text-slate-500">· {l.subject}</span>
                        <span className="block text-slate-600">{l.skipped || l.steps.map((s) => `${s.action} ${s.ok ? '✓' : `✗ ${s.error || ''}`}`).join(' · ')}</span>
                      </span>
                      <span className="text-slate-400 shrink-0">{new Date(l.at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {editing && data && <Editor initial={editing} data={data} templates={templates} templatesError={templatesError} tags={tags} agents={agents} onCancel={() => setEditing(null)} onSave={onSave} />}
    </section>
  );
}
