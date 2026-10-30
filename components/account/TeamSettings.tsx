'use client';

// Configuración → My account (password) and Team (members, roles, invitation links).
import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Link2, Loader2, MessageCircle, Trash2, UserPlus, Users } from 'lucide-react';
import { isCloud, clearLocalData } from '@/lib/cloud';

type Role = 'owner' | 'admin' | 'member';
const ROLE_LABEL: Record<Role, string> = { owner: 'Dueño', admin: 'Administrador', member: 'Equipo' };
const ROLE_HELP: Record<Role, string> = {
  owner: 'Todo, incluido cambiar dueños',
  admin: 'Todo, e invitar o quitar personas',
  member: 'Usa el panel (pedidos, mensajes, landings)',
};

interface Member {
  userId: string;
  role: Role;
  email: string;
  name: string | null;
}
interface Invite {
  token: string;
  role: Role;
  email: string | null;
  expiresAt: string;
  url: string;
}

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

const card = 'bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4';
const input = 'w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[13px] text-slate-800 focus:bg-white focus:ring-1 focus:ring-brand-red outline-none';

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt('Copia el enlace:', text);
        }
      }}
      className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {done ? 'Copiado' : 'Copiar'}
    </button>
  );
}

export default function TeamSettings() {
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<Role>('member');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Invite | null>(null);
  // password
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const load = () =>
    api('/api/team')
      .then((d) => {
        setMe(d.me);
        setRole(d.role);
        setMembers(d.members);
        setInvites(d.invites);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    isCloud().then((c) => {
      setCloud(c);
      if (c) load();
    });
  }, []);

  if (!cloud) return null;
  const manage = role === 'owner' || role === 'admin';

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const d = await api('/api/team', { method: 'POST', body: JSON.stringify({ role: newRole, email: newEmail.trim() || undefined }) });
      setCreated(d.invite);
      setNewEmail('');
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    try {
      await api('/api/account/password', { method: 'POST', body: JSON.stringify(pw) });
      setPw({ current: '', next: '' });
      setPwMsg({ ok: true, text: 'Contraseña cambiada. Se cerraron tus otras sesiones abiertas.' });
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.message });
    } finally {
      setPwBusy(false);
    }
  };
  const waShare = (inv: Invite) =>
    `https://wa.me/?text=${encodeURIComponent(`Te invito a nuestro panel de LogiPages como ${ROLE_LABEL[inv.role].toLowerCase()}. Entra aquí para crear tu acceso (vence en 7 días): ${inv.url}`)}`;

  return (
    <div className="space-y-6">
      {/* Team */}
      <div className={card}>
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Users className="w-4 h-4 text-brand-navy" />
          <h3 className="text-[15px] font-semibold text-slate-900">Equipo</h3>
        </div>
        <p className="text-xs text-slate-500">Cada persona entra con su propio correo y contraseña. Todos ven los datos de esta tienda.</p>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>}

        <div className="divide-y divide-slate-100">
          {members.map((m) => (
            <div key={m.userId} className="py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                {(m.name || m.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-900 truncate">
                  {m.name || m.email} {m.userId === me && <span className="text-xs text-slate-400">(tú)</span>}
                </p>
                <p className="text-xs text-slate-500 truncate">{m.email}</p>
              </div>
              {manage && m.userId !== me ? (
                <>
                  <select
                    value={m.role}
                    onChange={(e) => act(() => api('/api/team', { method: 'PATCH', body: JSON.stringify({ userId: m.userId, role: e.target.value }) }))}
                    className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white"
                    aria-label="Rol"
                  >
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r} disabled={r === 'owner' && role !== 'owner'}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => window.confirm(`¿Quitar a ${m.name || m.email} de la tienda?`) && act(() => api(`/api/team?userId=${encodeURIComponent(m.userId)}`, { method: 'DELETE' }))}
                    className="p-2 text-slate-400 hover:text-red-600"
                    aria-label="Quitar del equipo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <span className="text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">{ROLE_LABEL[m.role]}</span>
              )}
            </div>
          ))}
        </div>

        {manage && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <p className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Invitar a alguien
            </p>
            <form onSubmit={createInvite} className="grid sm:grid-cols-[1fr_160px_auto] gap-2">
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Correo (opcional)" type="email" className={input} />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className={input} aria-label="Rol de la persona invitada">
                <option value="member">Equipo</option>
                <option value="admin">Administrador</option>
                {role === 'owner' && <option value="owner">Dueño</option>}
              </select>
              <button disabled={creating} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Crear enlace
              </button>
            </form>
            <p className="text-[11px] text-slate-500">
              {ROLE_LABEL[newRole]}: {ROLE_HELP[newRole]}. El enlace vence en 7 días y sirve una sola vez. Si pones un correo, solo esa persona puede usarlo.
            </p>
            {created && (
              <div className="rounded-lg bg-white border border-emerald-200 p-3 space-y-2">
                <p className="text-xs font-semibold text-emerald-800">Enlace listo. Envíaselo a la persona:</p>
                <p className="text-[11px] font-mono break-all text-slate-700 bg-slate-50 rounded p-2">{created.url}</p>
                <div className="flex gap-2">
                  <CopyButton text={created.url} />
                  <a href={waShare(created)} target="_blank" rel="noreferrer" className="h-8 px-2.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold inline-flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> Enviar por WhatsApp
                  </a>
                </div>
              </div>
            )}
            {invites.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Invitaciones pendientes</p>
                {invites.map((i) => (
                  <div key={i.token} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 min-w-0 truncate text-slate-700">
                      {i.email || 'Cualquier persona con el enlace'} · {ROLE_LABEL[i.role]} · vence {new Date(i.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                    <CopyButton text={i.url} />
                    <button onClick={() => act(() => api(`/api/team?invite=${encodeURIComponent(i.token)}`, { method: 'DELETE' }))} className="p-1.5 text-slate-400 hover:text-red-600" aria-label="Cancelar invitación">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* My account */}
      <div className={card}>
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <KeyRound className="w-4 h-4 text-brand-navy" />
          <h3 className="text-[15px] font-semibold text-slate-900">Mi contraseña</h3>
        </div>
        <form onSubmit={changePw} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-start">
          <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="Contraseña actual" className={input} />
          <input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="Nueva (mínimo 8)" className={input} />
          <button disabled={pwBusy || !pw.current || pw.next.length < 8} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
            {pwBusy && <Loader2 className="w-4 h-4 animate-spin" />} Cambiar
          </button>
        </form>
        {pwMsg && <p className={`text-xs ${pwMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{pwMsg.text}</p>}
        {members.length > 0 && me && (
          <button
            type="button"
            onClick={() =>
              window.confirm('¿Salir de esta tienda? Ya no podrás ver sus datos.') &&
              api(`/api/team?userId=${encodeURIComponent(me)}`, { method: 'DELETE' })
                .then(() => fetch('/api/auth/logout', { method: 'POST' }))
                .then(() => (clearLocalData(), (window.location.href = '/login')))
                .catch((e) => setError(e.message))
            }
            className="text-xs text-slate-400 hover:text-red-600"
          >
            Salir de esta tienda
          </button>
        )}
      </div>
    </div>
  );
}
