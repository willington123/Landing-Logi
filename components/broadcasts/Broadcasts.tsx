'use client';

// Envíos masivos: choose an approved template, paste the list of customers, say what goes in each variable, and
// send one by one or all the pending ones in a row (one at a time, with a short pause, so it can be stopped).
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Pause, Play, Plus, Send, Trash2, Upload, Users, XCircle } from 'lucide-react';
import { fillBody, guessVars, importCsv, parseList, rowVars, type Broadcast, type BroadcastRow, type TemplateOption, type VarSource } from '@/lib/broadcast';

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
  const [showPaste, setShowPaste] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<(BroadcastRow & { off?: boolean })[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [vars, setVars] = useState<VarSource[]>([]);
  const [touched, setTouched] = useState(false);
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const t = templates.find((x) => `${x.name}|${x.lang}` === tKey) || null;
  const colsKey = columns.join('|');
  useEffect(() => {
    // Guessed from the template's words and the list's columns, until the store changes something by hand.
    if (t && !touched) setVars(guessVars(t.body, t.vars, columns));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tKey, colsKey, touched]);

  const applyList = (r: { columns: string[]; rows: BroadcastRow[] }, note: string) => {
    setColumns(r.columns);
    setRows(r.rows);
    setSummary(note);
    setTouched(false);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const content = await f.text();
    const r = importCsv(content);
    const gone = r.removed;
    applyList(
      r,
      `${r.rows.length} ${r.rows.length === 1 ? 'cliente' : 'clientes'}${r.kind === 'shopify' ? ' del archivo de Shopify' : ''}` +
        [gone.tests && `${gone.tests} de prueba quitados`, gone.duplicates && `${gone.duplicates} repetidos quitados`, gone.done && `${gone.done} ya comprados quitados`, gone.noPhone && `${gone.noPhone} sin celular`]
          .filter(Boolean)
          .map((x) => ` · ${x}`)
          .join(''),
    );
    if (fileInput.current) fileInput.current.value = '';
  };
  const onPaste = (v: string) => {
    setText(v);
    const p = parseList(v);
    applyList(p, `${p.rows.length} ${p.rows.length === 1 ? 'cliente' : 'clientes'}${p.invalid ? ` · ${p.invalid} sin celular válido` : ''}${p.duplicates ? ` · ${p.duplicates} repetidos quitados` : ''}`);
  };
  const editRow = (i: number, patch: Partial<BroadcastRow & { off?: boolean }>) => setRows((all) => all.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const editCol = (i: number, c: number, v: string) => setRows((all) => all.map((r, k) => (k === i ? { ...r, cols: r.cols.map((x, j) => (j === c ? v : x)) } : r)));
  const chosen = rows.filter((r) => !r.off);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await call<{ broadcast: Broadcast }>('/api/broadcasts', {
        method: 'POST',
        body: JSON.stringify({ name, template: t ? { name: t.name, lang: t.lang } : null, vars, image, columns, rows: chosen.map(({ phone, name, cols }) => ({ phone, name, cols })) }),
      });
      onCreated(d.broadcast.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const varLabel = (v: VarSource) => (v.kind === 'name' ? 'Nombre' : v.kind === 'col' ? columns[v.col] || `Columna ${v.col + 1}` : 'Texto fijo');

  return (
    <div className="space-y-4">
      <button type="button" onClick={onCancel} className="text-sm text-slate-600 inline-flex items-center gap-1 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Envíos masivos
      </button>
      <div className={`${card} space-y-6`}>
        <h2 className="text-lg font-semibold text-slate-900">Nuevo envío</h2>
        <label className="block text-sm text-slate-700">
          Nombre del envío (solo para ti)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Carritos noviembre" className={input} />
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-800">
            1. Plantilla
            <select aria-label="Plantilla" value={tKey} onChange={(e) => (setTKey(e.target.value), setTouched(false))} className={input}>
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
            <p className="mt-1 text-[12px] text-amber-700">
              Es de marketing: Meta cobra cada mensaje y no la entrega a quien ya recibió muchos mensajes de marketing. Para clientes que dejaron sus datos, una de <b>Utilidad</b> (como la de
              confirmación de pedido) llega mejor.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">2. Clientes</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-1.5">
              <Upload className="w-4 h-4" /> Subir archivo (.csv)
            </button>
            <button type="button" onClick={() => setShowPaste((v) => !v)} className="h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-700">
              o pegar una lista
            </button>
            <input ref={fileInput} type="file" accept=".csv,text/csv" aria-label="Archivo de clientes" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <p className="text-[12px] text-slate-500">
            Sirve el archivo que descargas de Shopify (Pedidos → Pedidos preliminares o Pedidos abandonados → Exportar): cada cliente queda con su producto, unidades, total y ciudad. También
            un Excel guardado como CSV con celular, nombre y otras columnas.
          </p>
          {showPaste && (
            <textarea
              aria-label="Lista de clientes"
              value={text}
              onChange={(e) => onPaste(e.target.value)}
              rows={6}
              placeholder={'celular;nombre;producto;total;ciudad\n3001234567;Laura Gómez;Bálsamo Rosa (1 unidad);$79.900;Cali'}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          )}
          {summary && (
            <p className="text-[12.5px] text-slate-700">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              {summary}
            </p>
          )}
        </div>

        {t && t.vars > 0 && columns.length + rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">3. Qué va en cada dato</p>
            <p className="text-[12px] text-slate-500">Konnexa lo eligió según la plantilla. Cámbialo solo si no corresponde.</p>
            {vars.map((v, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="w-14 text-[13px] font-mono text-sky-700">{`{{${i + 1}}}`}</span>
                <select
                  aria-label={`Dato ${i + 1}`}
                  value={v.kind === 'col' ? `col:${v.col}` : v.kind}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTouched(true);
                    setVars((all) => all.map((x, k) => (k !== i ? x : val === 'name' ? { kind: 'name' } : val === 'text' ? { kind: 'text', text: '' } : { kind: 'col', col: Number(val.split(':')[1]) })));
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px]"
                >
                  <option value="name">Nombre del cliente</option>
                  {columns.map((c, k) => (
                    <option key={k} value={`col:${k}`}>
                      {c}
                    </option>
                  ))}
                  <option value="text">Texto fijo (igual para todos)…</option>
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

        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-sm font-medium text-slate-800">{t ? '4.' : '3.'} Revisa cada cliente</p>
              <span className="text-[12px] text-slate-500">
                Corrige lo que haga falta o quita el chulito a quien no quieras escribirle. {chosen.length} de {rows.length} seleccionados.
              </span>
            </div>
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {rows.map((r, i) => (
                <div key={i} className={`rounded-xl border p-3 space-y-2 ${r.off ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" aria-label={`Incluir ${r.name || r.phone}`} checked={!r.off} onChange={(e) => editRow(i, { off: !e.target.checked })} className="w-4 h-4" />
                    <input
                      aria-label={`Nombre ${i + 1}`}
                      value={r.name}
                      onChange={(e) => editRow(i, { name: e.target.value })}
                      placeholder="Nombre"
                      className="flex-1 min-w-[140px] h-8 rounded-lg border border-slate-200 px-2 text-[13px] font-medium"
                    />
                    <span className="text-[12.5px] font-mono text-slate-500">+{r.phone}</span>
                  </div>
                  {columns.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {columns.map((c, j) => (
                        <label key={j} className="block text-[11px] text-slate-500">
                          {c}
                          <input
                            aria-label={`${c} ${i + 1}`}
                            value={r.cols[j] || ''}
                            onChange={(e) => editCol(i, j, e.target.value)}
                            className="mt-0.5 block w-full h-8 rounded-lg border border-slate-200 px-2 text-[12.5px] text-slate-800"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {t && <p className="rounded-lg bg-[#efeae2] px-2.5 py-1.5 text-[12px] text-slate-700 whitespace-pre-wrap">{fillBody(t.body, rowVars({ vars }, r))}</p>}
                </div>
              ))}
            </div>
            {t && vars.length > 0 && <p className="text-[11px] text-slate-400">Datos de la plantilla: {vars.map((v, i) => `{{${i + 1}}} ${varLabel(v)}`).join(' · ')}</p>}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={create}
            disabled={busy || !t || !chosen.length}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Crear envío ({chosen.length})
          </button>
          <button type="button" onClick={onCancel} className="h-10 px-3 text-sm text-slate-600">
            Cancelar
          </button>
        </div>
        <p className="text-[12px] text-slate-500">Crear el envío no manda nada todavía: en el siguiente paso envías uno por uno o todos.</p>
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
