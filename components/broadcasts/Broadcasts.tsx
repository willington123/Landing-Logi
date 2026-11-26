'use client';

// Envíos masivos: choose an approved template, paste the list of customers, say what goes in each variable, and
// send one by one or all the pending ones in a row (one at a time, with a short pause, so it can be stopped).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Pause, Play, Plus, Send, Trash2, Users, XCircle } from 'lucide-react';
import { fillBody, parseList, rowVars, type Broadcast, type TemplateOption, type VarSource } from '@/lib/broadcast';

interface Summary {
  id: string;
  name: string;
  template: string;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
}

async function call<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}
const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
const card = 'bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm';
const input = 'mt-1 block w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const PAUSE_MS = 1500;

export default function Broadcasts() {
  const [list, setList] = useState<Summary[] | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'new' | string>('list');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const d = await call<{
        broadcasts: Summary[];
        templates: TemplateOption[];
        templatesError: string | null;
      }>('/api/broadcasts');
      setList(d.broadcasts);
      setTemplates(d.templates);
      setTemplatesError(d.templatesError);
    } catch (e: any) {
      setError(e.message);
      setList([]);
    }
  };
  useEffect(() => {
    load();
  }, []);

  if (view === 'new') return <NewBroadcast templates={templates} templatesError={templatesError} onCancel={() => setView('list')} onCreated={(id) => (load(), setView(id))} />;
  if (view !== 'list') return <BroadcastDetail id={view} onBack={() => (load(), setView('list'))} />;

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-start gap-3`}>
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-lg font-semibold text-slate-900">Envíos masivos</h2>
          <p className="text-sm text-slate-500 mt-1">
            Escríbele a una lista de clientes con una plantilla aprobada: pegas la lista (de Excel o Google Sheets), eliges qué va en cada dato y envías uno por uno o todos
            seguidos. Cuando respondan, la conversación sigue en Mensajes.
          </p>
        </div>
        <button type="button" onClick={() => setView('new')} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nuevo envío
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {list === null ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
      ) : !list.length ? (
        <div className={`${card} text-sm text-slate-500`}>Todavía no has hecho envíos.</div>
      ) : (
        <div className="grid gap-3">
          {list.map((b) => (
            <button key={b.id} type="button" onClick={() => setView(b.id)} className={`${card} text-left hover:border-slate-300 transition`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{b.name}</span>
                <span className="text-[12px] font-mono text-slate-500">{b.template}</span>
                <span className="ml-auto text-[12px] text-slate-400">{when(b.createdAt)}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden flex">
                <div className="bg-emerald-500" style={{ width: `${(b.sent / Math.max(1, b.total)) * 100}%` }} />
                <div
                  className="bg-red-400"
                  style={{
                    width: `${(b.failed / Math.max(1, b.total)) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-[12.5px] text-slate-600">
                {b.sent} de {b.total} enviados
                {b.failed ? ` · ${b.failed} con error` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- new send ----------

function NewBroadcast({
  templates,
  templatesError,
  onCancel,
  onCreated,
}: {
  templates: TemplateOption[];
  templatesError: string | null;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [tKey, setTKey] = useState('');
  const [text, setText] = useState('');
  const [vars, setVars] = useState<VarSource[]>([]);
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = templates.find((x) => `${x.name}|${x.lang}` === tKey) || null;
  const parsed = useMemo(() => parseList(text), [text]);
  const [touched, setTouched] = useState(false);
  const colsKey = parsed.columns.join('|');
  useEffect(() => {
    // {{1}} → the customer's name by default; the others → the next columns, or a fixed text. Recalculated when
    // the template or the list's columns change, until the store picks something by hand.
    if (t && !touched)
      setVars(Array.from({ length: t.vars }, (_, i) => (i === 0 ? { kind: 'name' } : i - 1 < parsed.columns.length ? { kind: 'col', col: i - 1 } : { kind: 'text', text: '' })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tKey, colsKey, touched]);
  const preview = t && parsed.rows[0] ? fillBody(t.body, rowVars({ vars }, parsed.rows[0])) : t ? t.body : '';

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await call<{ broadcast: Broadcast }>('/api/broadcasts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          template: t ? { name: t.name, lang: t.lang } : null,
          vars,
          image,
          list: text,
        }),
      });
      onCreated(d.broadcast.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onCancel} className="text-sm text-slate-600 inline-flex items-center gap-1 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Envíos masivos
      </button>
      <div className={`${card} space-y-5`}>
        <h2 className="text-lg font-semibold text-slate-900">Nuevo envío</h2>
        <label className="block text-sm text-slate-700">
          Nombre del envío (solo para ti)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Carritos noviembre" className={input} />
        </label>

        <div>
          <label className="block text-sm text-slate-700">
            1. Plantilla
            <select value={tKey} onChange={(e) => (setTKey(e.target.value), setTouched(false))} className={input}>
              <option value="">Elige una plantilla aprobada…</option>
              {templates.map((x) => (
                <option key={`${x.name}|${x.lang}`} value={`${x.name}|${x.lang}`} disabled={!x.supported}>
                  {x.name} · {x.category === 'MARKETING' ? 'Marketing' : x.category === 'UTILITY' ? 'Utilidad' : x.category}
                  {x.supported ? '' : ` (no se puede: ${x.why})`}
                </option>
              ))}
            </select>
          </label>
          {templatesError && <p className="mt-1 text-[12.5px] text-red-600">{templatesError}</p>}
          {!templatesError && !templates.length && <p className="mt-1 text-[12.5px] text-slate-500">No tienes plantillas aprobadas. Créalas en Plantillas.</p>}
          {t?.category === 'MARKETING' && (
            <p className="mt-1 text-[12px] text-amber-700">Es de marketing: Meta cobra cada mensaje y puede no entregarlo a quien recibe muchos mensajes de marketing.</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-slate-700">
            2. Lista de clientes
            <textarea
              aria-label="Lista de clientes"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder={'Pega aquí desde Excel o Google Sheets, o escribe una por línea:\n3001234567, Laura Gómez, Bálsamo Rosa\n3109876543, Pedro Ruiz, Faja moldeadora'}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
          {text.trim() && (
            <p className="mt-1 text-[12.5px] text-slate-600">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              <b>{parsed.rows.length}</b> {parsed.rows.length === 1 ? 'contacto' : 'contactos'}
              {parsed.invalid ? ` · ${parsed.invalid} sin celular válido` : ''}
              {parsed.duplicates ? ` · ${parsed.duplicates} repetidos (se envía una sola vez)` : ''}
              {parsed.columns.length ? ` · columnas extra: ${parsed.columns.join(', ')}` : ''}
            </p>
          )}
        </div>

        {t && t.vars > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">3. ¿Qué va en cada dato de la plantilla?</p>
            {vars.map((v, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="w-14 text-[13px] font-mono text-sky-700">{`{{${i + 1}}}`}</span>
                <select
                  aria-label={`Dato ${i + 1}`}
                  value={v.kind === 'col' ? `col:${v.col}` : v.kind}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTouched(true);
                    setVars((all) =>
                      all.map((x, k) =>
                        k !== i ? x : val === 'name' ? { kind: 'name' } : val === 'text' ? { kind: 'text', text: '' } : { kind: 'col', col: Number(val.split(':')[1]) },
                      ),
                    );
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px]"
                >
                  <option value="name">Nombre del cliente</option>
                  {parsed.columns.map((c, k) => (
                    <option key={k} value={`col:${k}`}>
                      {c}
                    </option>
                  ))}
                  <option value="text">Texto fijo…</option>
                </select>
                {v.kind === 'text' && (
                  <input
                    aria-label={`Texto del dato ${i + 1}`}
                    value={v.text}
                    onChange={(e) => (setTouched(true), setVars((all) => all.map((x, k) => (k === i ? { kind: 'text', text: e.target.value } : x))))}
                    placeholder="Ej.: Bálsamo Rosa"
                    className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]"
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {t?.imageHeader && (
          <label className="block text-sm text-slate-700">
            Foto de arriba (enlace https de la imagen, .jpg o .png)
            <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…/foto.jpg" className={input} />
          </label>
        )}

        {t && (
          <div>
            <p className="text-sm text-slate-700">Así le llega {parsed.rows[0] ? `a ${parsed.rows[0].name || `+${parsed.rows[0].phone}`}` : 'al cliente'}:</p>
            <div className="mt-1 rounded-xl bg-[#efeae2] p-3">
              <p className="max-w-md rounded-lg bg-white px-3 py-2 text-[13px] text-slate-800 whitespace-pre-wrap shadow-sm">{preview}</p>
              {t.buttons.length > 0 && <p className="mt-1 text-[12px] text-sky-700">{t.buttons.join(' · ')}</p>}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={create}
            disabled={busy || !t || !parsed.rows.length}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Crear envío ({parsed.rows.length})
          </button>
          <button type="button" onClick={onCancel} className="h-10 px-3 text-sm text-slate-600">
            Cancelar
          </button>
        </div>
        <p className="text-[12px] text-slate-500">Crear el envío no manda nada todavía: en el siguiente paso eliges a quién enviar.</p>
      </div>
    </div>
  );
}

// ---------- one send ----------

function BroadcastDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [b, setB] = useState<Broadcast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const load = async () => {
    try {
      setB((await call<{ broadcast: Broadcast }>(`/api/broadcasts/${id}`)).broadcast);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    return () => {
      stop.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sendOne = async (i: number): Promise<boolean> => {
    setBusyRow(i);
    try {
      const d = await call<{ row: Broadcast['rows'][number] }>(`/api/broadcasts/${id}/send`, { method: 'POST', body: JSON.stringify({ index: i }) });
      setB((x) => (x ? { ...x, rows: x.rows.map((r, k) => (k === i ? d.row : r)) } : x));
      return d.row.status === 'sent';
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusyRow(null);
    }
  };

  const sendAll = async () => {
    if (!b) return;
    const todo = b.rows.map((r, i) => (r.status === 'pending' ? i : -1)).filter((i) => i >= 0);
    if (!todo.length) return;
    if (
      !confirm(
        `¿Enviar la plantilla «${b.template.name}» a ${todo.length} ${todo.length === 1 ? 'contacto' : 'contactos'}, uno por uno?${b.template.category === 'MARKETING' ? ' Meta cobra cada mensaje de marketing.' : ''} Puedes pausar cuando quieras.`,
      )
    )
      return;
    stop.current = false;
    setRunning(true);
    setError(null);
    let failedInRow = 0;
    for (const i of todo) {
      if (stop.current) break;
      const ok = await sendOne(i);
      failedInRow = ok ? 0 : failedInRow + 1;
      // Several errors in a row usually mean the template or the number has a problem: stop and show it.
      if (failedInRow >= 3) {
        setError('Se detuvo: 3 envíos seguidos fallaron. Revisa el error de los contactos y vuelve a intentar.');
        break;
      }
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
    setRunning(false);
  };

  const remove = async () => {
    if (!confirm('¿Borrar este envío de la lista? Los mensajes ya enviados no se borran de los chats.')) return;
    await call(`/api/broadcasts/${id}`, { method: 'DELETE' }).catch(() => null);
    onBack();
  };

  if (!b) return error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="w-5 h-5 animate-spin text-slate-300" />;
  const sent = b.rows.filter((r) => r.status === 'sent').length;
  const failed = b.rows.filter((r) => r.status === 'failed').length;
  const pending = b.rows.length - sent - failed;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-slate-600 inline-flex items-center gap-1 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Envíos masivos
      </button>
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-lg font-semibold text-slate-900">{b.name}</h2>
            <p className="text-[12.5px] text-slate-500">
              Plantilla <span className="font-mono">{b.template.name}</span> · creado {when(b.createdAt)}
              {b.by ? ` por ${b.by}` : ''}
            </p>
          </div>
          <button type="button" onClick={remove} disabled={running} className="h-9 px-2 text-[13px] text-slate-500 hover:text-red-600 inline-flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> Borrar
          </button>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
          <div className="bg-emerald-500 transition-all" style={{ width: `${(sent / Math.max(1, b.rows.length)) * 100}%` }} />
          <div className="bg-red-400 transition-all" style={{ width: `${(failed / Math.max(1, b.rows.length)) * 100}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-700">
            <b>{sent}</b> enviados · <b>{pending}</b> pendientes
            {failed ? ` · ${failed} con error` : ''}
          </span>
          {running ? (
            <button
              type="button"
              onClick={() => (stop.current = true)}
              className="ml-auto h-10 px-4 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5"
            >
              <Pause className="w-4 h-4" /> Pausar
            </button>
          ) : (
            <button
              type="button"
              onClick={sendAll}
              disabled={!pending || busyRow !== null}
              className="ml-auto h-10 px-4 rounded-xl bg-[#25D366] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <Play className="w-4 h-4" /> Enviar a los {pending} pendientes
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className={`${card} p-0 sm:p-0 overflow-hidden`}>
        <div className="divide-y divide-slate-100">
          {b.rows.map((r, i) => {
            const text = fillBody(b.template.body, rowVars(b, r));
            return (
              <div key={r.phone} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium text-slate-900">
                    {r.name || 'Sin nombre'} <span className="text-slate-400 font-normal">· +{r.phone}</span>
                  </p>
                  <p className="text-slate-500 truncate" title={text}>
                    {text}
                  </p>
                  {r.status === 'failed' && r.error && <p className="text-[12px] text-red-600">{r.error}</p>}
                </div>
                {r.status === 'sent' ? (
                  <span className="text-[12px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Enviado {when(r.sentAt)}
                  </span>
                ) : (
                  <>
                    {r.status === 'failed' && (
                      <span className="text-[12px] font-semibold text-red-600 inline-flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Error
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => sendOne(i)}
                      disabled={running || busyRow !== null}
                      className="h-8 px-3 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      {busyRow === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {r.status === 'failed' ? 'Reintentar' : 'Enviar'}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
