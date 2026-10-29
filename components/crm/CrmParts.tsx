'use client';

// Pieces of the WhatsApp inbox: tags, quick replies and their editors.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Settings2, Tag, Trash2, X, Zap } from 'lucide-react';
import { TAG_COLORS, type CrmTag, type QuickReply, type TagColor, shortcutFrom } from '@/lib/crm';

export async function crmApi<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ---------- tags ----------

export function TagChip({ tag, small }: { tag: CrmTag; small?: boolean }) {
  const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
  return (
    <span className={`inline-flex items-center rounded-full ring-1 ring-inset font-medium whitespace-nowrap ${c.chip} ${small ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}>
      {tag.name}
    </span>
  );
}

// Popover in the chat header: tick the tags of this conversation.
export function TagPicker({
  tags,
  selected,
  onChange,
  onManage,
}: {
  tags: CrmTag[];
  selected: string[];
  onChange: (ids: string[]) => Promise<void>;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const toggle = async (id: string) => {
    setBusy(id);
    try {
      await onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
        aria-label="Etiquetas"
      >
        <Tag className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Etiquetas</span>
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-60 bg-white rounded-xl border border-slate-200 shadow-lg p-1.5">
          {tags.length === 0 && <p className="text-xs text-slate-500 p-2">Aún no tienes etiquetas.</p>}
          {tags.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button key={t.id} onClick={() => toggle(t.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left">
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300'}`}>
                  {busy === t.id ? <Loader2 className="w-3 h-3 animate-spin text-slate-400" /> : on && <Check className="w-3 h-3" />}
                </span>
                <span className={`w-2 h-2 rounded-full ${TAG_COLORS[t.color]?.dot || 'bg-slate-400'}`} />
                <span className="text-[13px] text-slate-800 truncate">{t.name}</span>
              </button>
            );
          })}
          <button
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="w-full mt-1 border-t border-slate-100 flex items-center gap-2 px-2 pt-2 pb-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <Settings2 className="w-3.5 h-3.5" /> Administrar etiquetas
          </button>
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TagManager({ tags, onClose, onSaved }: { tags: CrmTag[]; onClose: () => void; onSaved: (t: CrmTag[]) => void }) {
  const [items, setItems] = useState<CrmTag[]>(tags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, patch: Partial<CrmTag>) => setItems((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const d = await crmApi<{ items: CrmTag[] }>('/api/whatsapp/tags', { method: 'PUT', body: JSON.stringify({ items }) });
      onSaved(d.items);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Etiquetas" onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        <p className="text-xs text-slate-500">Úsalas para ordenar los chats y filtrarlos. Si borras una, se quita de todas las conversaciones.</p>
        {items.map((t, i) => (
          <div key={t.id || `new-${i}`} className="flex items-center gap-2">
            <select
              value={t.color}
              onChange={(e) => set(i, { color: e.target.value as TagColor })}
              className="h-9 text-xs border border-slate-200 rounded-lg px-2 bg-white"
              aria-label="Color"
            >
              {(Object.keys(TAG_COLORS) as TagColor[]).map((c) => (
                <option key={c} value={c}>
                  {TAG_COLORS[c].label}
                </option>
              ))}
            </select>
            <input
              value={t.name}
              maxLength={30}
              onChange={(e) => set(i, { name: e.target.value })}
              className="flex-1 h-9 text-[13px] border border-slate-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            <span className="w-32 hidden sm:flex justify-end">
              <TagChip tag={{ ...t, name: t.name || '—' }} />
            </span>
            <button onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-600" aria-label="Borrar etiqueta">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setItems((prev) => [...prev, { id: '', name: '', color: 'blue' }])}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 pt-1"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva etiqueta
        </button>
      </div>
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
        {error && <p className="text-xs text-red-600 mr-auto">{error}</p>}
        <button onClick={onClose} className="h-9 px-3 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button onClick={save} disabled={saving} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
        </button>
      </div>
    </Modal>
  );
}

// ---------- quick replies ----------

// Best matches first: shortcut starts with the text, then shortcut/title contain it, then the message text.
export function matchReplies(replies: QuickReply[], q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return replies;
  const rank = (r: QuickReply) =>
    r.shortcut.startsWith(s) ? 0 : r.shortcut.includes(s) || r.title.toLowerCase().includes(s) ? 1 : r.body.toLowerCase().includes(s) ? 2 : -1;
  return replies
    .map((r, i) => ({ r, i, k: rank(r) }))
    .filter((x) => x.k >= 0)
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r);
}

// List shown above the reply box (opened with ⚡ or by typing "/").
export function QuickReplyMenu({
  replies,
  query,
  highlight,
  preview,
  onPick,
  onHover,
  onManage,
  onClose,
}: {
  replies: QuickReply[];
  query: string;
  highlight: number;
  preview: (r: QuickReply) => string;
  onPick: (r: QuickReply) => void;
  onHover: (i: number) => void;
  onManage: () => void;
  onClose: () => void;
}) {
  const list = matchReplies(replies, query);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);
  return (
    <div className="absolute left-0 right-0 bottom-full mb-2 z-30 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-500" /> Respuestas rápidas {query && <span className="font-normal">· /{query}</span>}
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {list.length === 0 && <p className="text-xs text-slate-500 px-3 py-3">No hay respuestas con “{query}”.</p>}
        {list.map((r, i) => (
          <button
            key={r.id}
            ref={i === highlight ? activeRef : undefined}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(e) => {
              e.preventDefault(); // keep the focus in the reply box
              onPick(r);
            }}
            className={`w-full text-left px-3 py-2 border-b border-slate-50 ${i === highlight ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500">/{r.shortcut}</span>
              <span className="text-[13px] font-medium text-slate-900">{r.title}</span>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2 whitespace-pre-wrap">{preview(r)}</p>
          </button>
        ))}
      </div>
      <button onMouseDown={(e) => (e.preventDefault(), onManage())} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border-t border-slate-100">
        <Settings2 className="w-3.5 h-3.5" /> Administrar respuestas rápidas
      </button>
    </div>
  );
}

export function QuickReplyManager({ replies, onClose, onSaved }: { replies: QuickReply[]; onClose: () => void; onSaved: (r: QuickReply[]) => void }) {
  const [items, setItems] = useState<QuickReply[]>(replies);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, patch: Partial<QuickReply>) => setItems((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const d = await crmApi<{ items: QuickReply[] }>('/api/whatsapp/quick-replies', { method: 'PUT', body: JSON.stringify({ items }) });
      onSaved(d.items);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const vars = useMemo(() => ['{nombre}', '{pedido}', '{producto}', '{total}', '{ciudad}', '{direccion}'], []);
  return (
    <Modal title="Respuestas rápidas" onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        <p className="text-xs text-slate-500">
          En el chat escribe <strong>/</strong> y el atajo (por ejemplo <strong>/envio</strong>) o pulsa ⚡. Puedes usar {vars.join(' ')}: se llenan solos con los datos del cliente y su
          pedido.
        </p>
        {items.map((r, i) =>
          editing === i ? (
            <div key={r.id || i} className="rounded-xl border border-slate-300 p-3 space-y-2 bg-slate-50/60">
              <div className="flex gap-2">
                <input
                  value={r.title}
                  maxLength={60}
                  placeholder="Nombre (ej. Pedido despachado)"
                  onChange={(e) => set(i, { title: e.target.value, ...(r.id ? {} : { shortcut: shortcutFrom(e.target.value) }) })}
                  className="flex-1 h-9 text-[13px] border border-slate-200 rounded-lg px-3 bg-white"
                />
                <div className="flex items-center h-9 border border-slate-200 rounded-lg bg-white px-2 text-[13px] w-36">
                  <span className="text-slate-400">/</span>
                  <input value={r.shortcut} maxLength={20} placeholder="atajo" onChange={(e) => set(i, { shortcut: shortcutFrom(e.target.value) })} className="w-full outline-none font-mono text-xs" />
                </div>
              </div>
              <textarea
                value={r.body}
                maxLength={1000}
                rows={4}
                placeholder="Texto del mensaje"
                onChange={(e) => set(i, { body: e.target.value })}
                className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2 bg-white"
              />
              <div className="flex flex-wrap gap-1">
                {vars.map((v) => (
                  <button key={v} onClick={() => set(i, { body: `${r.body}${r.body && !r.body.endsWith(' ') ? ' ' : ''}${v}` })} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">
                    {v}
                  </button>
                ))}
                <button onClick={() => setEditing(null)} className="ml-auto text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Listo
                </button>
              </div>
            </div>
          ) : (
            <div key={r.id || i} className="rounded-xl border border-slate-200 px-3 py-2 flex gap-2 items-start">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-500">/{r.shortcut || '—'}</span>
                  <span className="text-[13px] font-medium text-slate-900 truncate">{r.title || 'Sin nombre'}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 whitespace-pre-wrap">{r.body}</p>
              </div>
              <button onClick={() => setEditing(i)} className="p-1.5 text-slate-400 hover:text-slate-800" aria-label="Editar">
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setItems((prev) => prev.filter((_, j) => j !== i));
                  setEditing(null);
                }}
                className="p-1.5 text-slate-400 hover:text-red-600"
                aria-label="Borrar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ),
        )}
        <button
          onClick={() => {
            setItems((prev) => [...prev, { id: '', shortcut: '', title: '', body: '' }]);
            setEditing(items.length);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 pt-1"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva respuesta
        </button>
      </div>
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
        {error && <p className="text-xs text-red-600 mr-auto">{error}</p>}
        <button onClick={onClose} className="h-9 px-3 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button onClick={save} disabled={saving} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
        </button>
      </div>
    </Modal>
  );
}
