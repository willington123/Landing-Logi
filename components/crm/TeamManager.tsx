'use client';

// Mensajes → Equipo: the people who answer chats (linked to their accounts), automatic assignment in turns,
// and how each person is doing.
import React, { useEffect, useState } from 'react';
import { chatOrgHeaders } from '@/lib/inbox-stores';
import Link from 'next/link';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { TAG_COLORS, type Agent, type RoutingSettings, type TagColor } from '@/lib/crm';
import { AgentBadge } from '@/components/crm/CrmParts';

interface Member {
  userId: string;
  name: string | null;
  email: string;
  role: 'owner' | 'admin' | 'member';
}
interface Info {
  items: Agent[];
  routing: RoutingSettings;
  members: Member[];
  me: { userId: string | null; agentId: string | null; role: string | null; canManage: boolean };
}
interface Row {
  key: string;
  name: string;
  color: string | null;
  assigned: number;
  chats: number;
  messages: number;
  medianReplyMin: number | null;
  orders: number;
  confirmed: number;
  revenue: number;
}

const ROLE: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', member: 'Miembro' };
const COLORS = Object.keys(TAG_COLORS) as TagColor[];

async function call(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: 'no-store', ...init, headers: { 'content-type': 'application/json', ...chatOrgHeaders() } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

const minutes = (m: number | null) => (m === null ? '—' : m < 1 ? '< 1 min' : m < 60 ? `${Math.round(m)} min` : `${Math.round((m / 60) * 10) / 10} h`);
const money = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition shrink-0 disabled:opacity-40 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export default function TeamManager({ onClose, onSaved }: { onClose: () => void; onSaved: (agents: Agent[]) => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [items, setItems] = useState<Agent[]>([]);
  const [routing, setRouting] = useState<RoutingSettings>({ enabled: false, when: 'new' });
  const [tab, setTab] = useState<'people' | 'routing' | 'report'>('people');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [days, setDays] = useState<7 | 30>(7);
  const [report, setReport] = useState<Row[] | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    call('/api/whatsapp/agents')
      .then((d: Info) => {
        setInfo(d);
        setItems(d.items);
        setRouting(d.routing);
      })
      .catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);

  useEffect(() => {
    if (tab !== 'report') return;
    setReport(null);
    setReportError(null);
    call(`/api/whatsapp/team-report?days=${days}`)
      .then((d) => setReport(d.rows))
      .catch((e) => setReportError(e.message));
  }, [tab, days]);

  const can = Boolean(info?.me.canManage);
  const set = (i: number, p: Partial<Agent>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const memberOf = (uid?: string | null) => info?.members.find((m) => m.userId === uid);
  const unlinked = (info?.members || []).filter((m) => !items.some((a) => a.userId === m.userId));

  const save = async (body: Record<string, unknown>, okText: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const d = await call('/api/whatsapp/agents', { method: 'PUT', body: JSON.stringify(body) });
      setItems(d.items);
      setRouting(d.routing);
      onSaved(d.items);
      setMsg({ ok: true, text: okText });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 flex sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Equipo</h3>
          <button onClick={onClose} className="hit w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pt-3 flex gap-2 overflow-x-auto">
          {(
            [
              ['people', 'Personas'],
              ['routing', 'Reparto automático'],
              ...(can ? [['report', 'Rendimiento']] : []),
            ] as [typeof tab, string][]
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`h-9 px-4 rounded-full text-[13px] font-medium whitespace-nowrap ${tab === k ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!info && !msg && <div className="h-32 rounded-xl bg-slate-50 animate-pulse" />}
          {msg && <p className={`text-[13px] ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}

          {info && tab === 'people' && (
            <>
              <p className="text-[13px] text-slate-600">
                Cada persona entra con su propia cuenta. Únela a su nombre aquí y Konnexa sabe quién es: sus chats aparecen en “Míos” y su nombre queda en cada mensaje que
                responde (el cliente no lo ve). {can && <Link href="/settings" className="font-semibold text-brand-blue">Invitar a más personas →</Link>}
              </p>
              {!can && <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">Solo el dueño o un administrador pueden cambiar el equipo.</p>}
              <ul className="space-y-2">
                {items.map((a, i) => {
                  const m = memberOf(a.userId);
                  return (
                    <li key={a.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <AgentBadge agent={a} size="md" />
                        <input value={a.name} disabled={!can} maxLength={30} onChange={(e) => set(i, { name: e.target.value })} className="flex-1 min-w-0 h-9 text-[13px] border border-slate-200 rounded-lg px-2" aria-label="Nombre" />
                        <select value={a.color} disabled={!can} onChange={(e) => set(i, { color: e.target.value as TagColor })} className="h-9 text-[12px] border border-slate-200 rounded-lg px-1 bg-white" aria-label="Color">
                          {COLORS.map((c) => (
                            <option key={c} value={c}>
                              {TAG_COLORS[c].label}
                            </option>
                          ))}
                        </select>
                        {can && (
                          <button onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="hit w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Quitar persona">
                            <Trash2 className="w-4 h-4 text-slate-500" />
                          </button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 sm:items-center">
                        <select value={a.userId || ''} disabled={!can} onChange={(e) => set(i, { userId: e.target.value || null, onlyAssigned: false })} className="h-9 text-[12px] border border-slate-200 rounded-lg px-2 bg-white" aria-label="Cuenta">
                          <option value="">Sin cuenta unida</option>
                          {info.members
                            .filter((x) => x.userId === a.userId || !items.some((y) => y.userId === x.userId))
                            .map((x) => (
                              <option key={x.userId} value={x.userId}>
                                {x.name || x.email} · {ROLE[x.role]}
                              </option>
                            ))}
                        </select>
                        <label className={`flex items-center gap-2 text-[12px] ${m?.role === 'member' ? 'text-slate-700' : 'text-slate-400'}`} title={m?.role === 'member' ? '' : 'Los dueños y administradores siempre ven todos los chats.'}>
                          <Switch on={Boolean(a.onlyAssigned)} disabled={!can || m?.role !== 'member'} onChange={(v) => set(i, { onlyAssigned: v })} label="Solo ve sus chats" /> Solo ve sus chats
                        </label>
                        <label className="flex items-center gap-2 text-[12px] text-slate-700">
                          <Switch on={a.available !== false} disabled={!can} onChange={(v) => set(i, { available: v })} label="Disponible" /> {a.available !== false ? 'Disponible' : 'Ausente'}
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {can && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setItems((xs) => [...xs, { id: '', name: '', color: COLORS[xs.length % COLORS.length], userId: null, onlyAssigned: false, available: true }])}
                    className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Agregar persona
                  </button>
                  {unlinked.length > 0 && (
                    <button
                      onClick={() =>
                        setItems((xs) => [
                          ...xs,
                          ...unlinked.map((m, k) => ({ id: '', name: (m.name || m.email.split('@')[0]).slice(0, 30), color: COLORS[(xs.length + k) % COLORS.length], userId: m.userId, onlyAssigned: false, available: true })),
                        ])
                      }
                      className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-700"
                    >
                      Agregar a todo el equipo ({unlinked.length})
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {info && tab === 'routing' && (
            <div className="space-y-3">
              <p className="text-[13px] text-slate-600">Konnexa reparte los chats sin dueño entre las personas disponibles, por turnos. Quien está “Ausente” no recibe chats nuevos.</p>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                <Switch on={routing.enabled} disabled={!can} onChange={(v) => setRouting((r) => ({ ...r, enabled: v }))} label="Repartir automáticamente" />
                <span>
                  <span className="block text-[13px] font-semibold text-slate-900">Repartir los chats automáticamente</span>
                  <span className="block text-[12px] text-slate-600">Si lo apagas, cada chat se asigna a mano.</span>
                </span>
              </label>
              {routing.enabled && (
                <div className="space-y-2 pl-1">
                  {(
                    [
                      ['new', 'Cada chat nuevo', 'Apenas el cliente escribe, el chat queda con alguien.'],
                      ['handoff', 'Solo cuando el asistente lo pasa a una persona', 'El asistente IA atiende primero; si no puede resolver, el chat va a la siguiente persona.'],
                    ] as const
                  ).map(([v, t, h]) => (
                    <label key={v} className="flex items-start gap-2 cursor-pointer">
                      <input type="radio" name="routing-when" disabled={!can} checked={routing.when === v} onChange={() => setRouting((r) => ({ ...r, when: v }))} className="mt-1" />
                      <span>
                        <span className="block text-[13px] font-medium text-slate-900">{t}</span>
                        <span className="block text-[12px] text-slate-600">{h}</span>
                      </span>
                    </label>
                  ))}
                  <p className="text-[12px] text-slate-500">
                    Hoy reciben chats: {items.filter((a) => a.available !== false).map((a) => a.name).join(', ') || 'nadie (todos ausentes)'}.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'report' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {([7, 30] as const).map((d) => (
                  <button key={d} onClick={() => setDays(d)} className={`h-8 px-3 rounded-full text-[12px] font-medium ${days === d ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600'}`}>
                    Últimos {d} días
                  </button>
                ))}
              </div>
              {reportError && <p className="text-[13px] text-red-600">{reportError}</p>}
              {!report && !reportError && <div className="h-24 rounded-xl bg-slate-50 animate-pulse" />}
              {report && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 text-slate-500 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Persona</th>
                        <th className="px-3 py-2 font-medium text-right">Chats suyos</th>
                        <th className="px-3 py-2 font-medium text-right">Atendió</th>
                        <th className="px-3 py-2 font-medium text-right">Mensajes</th>
                        <th className="px-3 py-2 font-medium text-right" title="Mediana del tiempo que el cliente esperó la respuesta">Responde en</th>
                        <th className="px-3 py-2 font-medium text-right">Pedidos</th>
                        <th className="px-3 py-2 font-medium text-right">Confirmados</th>
                        <th className="px-3 py-2 font-medium text-right">Ventas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.map((r) => (
                        <tr key={r.key}>
                          <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{r.name}</td>
                          <td className="px-3 py-2 text-right">{r.assigned}</td>
                          <td className="px-3 py-2 text-right">{r.chats}</td>
                          <td className="px-3 py-2 text-right">{r.messages}</td>
                          <td className="px-3 py-2 text-right">{minutes(r.medianReplyMin)}</td>
                          <td className="px-3 py-2 text-right">{r.orders}</td>
                          <td className="px-3 py-2 text-right">{r.confirmed}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{money(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-slate-500">“Responde en”: cuánto esperó el cliente desde que escribió hasta que esa persona le respondió. Pedidos: los de los chats que tiene asignados.</p>
            </div>
          )}
        </div>

        {info && can && tab !== 'report' && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button onClick={onClose} className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
              Cerrar
            </button>
            <button
              onClick={() => (tab === 'people' ? save({ items }, 'Equipo guardado.') : save({ routing }, routing.enabled ? 'Reparto automático encendido.' : 'Reparto automático apagado.'))}
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-brand-gradient text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
