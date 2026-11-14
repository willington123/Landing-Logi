'use client';

// Configuración → "Dominio propio": the store connects its own domain and its landings open there
// (https://ofertas.mitienda.com/<landing>). Shows the DNS record to create and whether it works yet.
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Globe, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { logiStore } from '@/lib/store';

export interface DomainRow {
  host: string;
  landing: string | null;
  addedAt: string;
  state: 'ready' | 'dns' | 'verify' | 'unknown';
  records: { type: string; name: string; value: string }[];
}

async function call<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json' } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

// The link to share for a landing: the store's own domain when it has one working, else Konnexa's.
let cached: { at: number; host: string | null } | null = null;
export async function storeDomain(): Promise<string | null> {
  if (cached && Date.now() - cached.at < 60_000) return cached.host;
  const d = await call<{ domains: DomainRow[] }>('/api/domains').catch(() => ({ domains: [] as DomainRow[] }));
  const ok = d.domains.find((x) => x.state === 'ready') || d.domains.find((x) => x.state === 'unknown') || null;
  cached = { at: Date.now(), host: ok?.host || null };
  return cached.host;
}
// Synchronous so the copy stays inside the click (Safari blocks clipboard writes after an await); call
// storeDomain() when the page opens so the domain is already known.
export function landingLink(slug: string, publishedUrl?: string): string {
  const host = cached?.host;
  return host ? `https://${host}/${slug}` : window.location.origin + (publishedUrl || `/p/${slug}`);
}

const STATE: Record<DomainRow['state'], { label: string; cls: string; help: string }> = {
  ready: { label: 'Funcionando', cls: 'bg-emerald-50 text-emerald-700', help: 'Tus landings ya abren en este dominio, con candado (HTTPS).' },
  dns: { label: 'Falta el registro DNS', cls: 'bg-amber-50 text-amber-800', help: 'Crea el registro de abajo donde compraste el dominio. Puede tardar desde minutos hasta unas horas en verse.' },
  verify: { label: 'Falta verificar', cls: 'bg-amber-50 text-amber-800', help: 'Este dominio ya se usó en otra cuenta de Vercel: crea también el registro TXT de abajo.' },
  unknown: { label: 'Configurado', cls: 'bg-slate-100 text-slate-700', help: 'Crea el registro de abajo donde compraste el dominio. El administrador de Konnexa debe agregarlo también en Vercel (Settings → Domains).' },
};

export default function DomainsCard() {
  const [rows, setRows] = useState<DomainRow[] | null>(null);
  const [host, setHost] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const landings = logiStore.getLandings().filter((l) => l.slug);

  const load = async () => {
    setError(null);
    try {
      const d = await call<{ domains: DomainRow[] }>('/api/domains');
      setRows(d.domains);
      const ok = d.domains.find((x) => x.state === 'ready') || d.domains.find((x) => x.state === 'unknown');
      cached = { at: Date.now(), host: ok?.host || null };
    } catch (e: any) {
      setError(e.message);
      setRows([]);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const copy = (v: string) => {
    navigator.clipboard.writeText(v).catch(() => {});
    setCopied(v);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#0A6CF0]" /> Dominio propio
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Conecta tu dominio (por ejemplo <b>ofertas.mitienda.com</b>) y tus landings se abren ahí: <b>ofertas.mitienda.com/nombre-de-la-landing</b>. Así puedes verificarlo en Meta
          para tus campañas.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (host.trim()) run('add', () => call('/api/domains', { method: 'POST', body: JSON.stringify({ host }) }).then(() => setHost('')));
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="ofertas.mitienda.com"
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1 h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        <button type="submit" disabled={busy !== null || !host.trim()} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
          {busy === 'add' && <Loader2 className="w-4 h-4 animate-spin" />} Conectar dominio
        </button>
      </form>
      <p className="text-[12px] text-slate-500">
        Recomendado: usa un <b>subdominio</b> (ofertas.mitienda.com o tienda.mitienda.com) y así tu página principal sigue igual. Si usas el dominio completo (mitienda.com), todo el
        dominio queda para tus landings.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows === null ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
      ) : (
        rows.map((d) => {
          const st = STATE[d.state];
          return (
            <div key={d.host} className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{d.host}</span>
                <span className={`text-[12px] font-semibold rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${st.cls}`}>
                  {d.state === 'ready' && <CheckCircle2 className="w-3.5 h-3.5" />} {st.label}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <button onClick={() => run(`r-${d.host}`, async () => {})} className="h-8 px-2 rounded-lg text-[12px] text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1" title="Revisar de nuevo">
                    <RefreshCw className={`w-3.5 h-3.5 ${busy === `r-${d.host}` ? 'animate-spin' : ''}`} /> Revisar
                  </button>
                  <button
                    onClick={() => confirm(`¿Desconectar ${d.host}? Tus landings dejan de abrir en ese dominio.`) && run(`x-${d.host}`, () => call(`/api/domains?host=${encodeURIComponent(d.host)}`, { method: 'DELETE' }))}
                    className="h-8 px-2 rounded-lg text-[12px] text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Quitar
                  </button>
                </span>
              </div>
              <p className="text-[12.5px] text-slate-600">{st.help}</p>
              {d.state !== 'ready' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1 pr-3 font-medium">Tipo</th>
                        <th className="py-1 pr-3 font-medium">Nombre / Host</th>
                        <th className="py-1 font-medium">Valor / Apunta a</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.records.map((r, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-1.5 pr-3 font-mono">{r.type}</td>
                          <td className="py-1.5 pr-3 font-mono">{r.name}</td>
                          <td className="py-1.5 font-mono break-all">
                            <button type="button" onClick={() => copy(r.value)} className="inline-flex items-center gap-1 hover:text-slate-900 text-left">
                              {r.value} {copied === r.value ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <label className="block text-[12.5px] text-slate-600">
                Landing que se abre en <b>{d.host}</b> (sin nada después)
                <select
                  value={d.landing || ''}
                  onChange={(e) => run(`l-${d.host}`, () => call('/api/domains', { method: 'PATCH', body: JSON.stringify({ host: d.host, landing: e.target.value || null }) }))}
                  className="mt-1 block w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px]"
                >
                  <option value="">Ninguna (muestra “página no encontrada”)</option>
                  {landings.map((l) => (
                    <option key={l.id} value={l.slug}>
                      {l.productName} ({l.slug})
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[12px] text-slate-500">
                Tus landings: <span className="font-mono">https://{d.host}/nombre-de-la-landing</span>. Para Meta, verifica <b>{d.host.split('.').slice(-2).join('.')}</b> en Configuración del
                negocio → Seguridad de la marca → Dominios (con el registro TXT que te da Meta, en el mismo lugar donde pones el registro de arriba).
              </p>
            </div>
          );
        })
      )}
    </div>
  );
}
