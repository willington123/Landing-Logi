// Custom domains: a store connects its own domain (e.g. ofertas.mitienda.com) and its landings open there
// (https://ofertas.mitienda.com/<slug>). The map host → store lives in platform_settings ("domains") so the
// middleware can look it up for any request. With VERCEL_TOKEN + VERCEL_PROJECT_ID the domain is also added to the
// Vercel project (and its DNS status read from Vercel); without them the platform admin adds it in Vercel by hand.
import { rawDb } from '@/lib/server/supabase';

export interface DomainEntry {
  org: string;
  landing: string | null; // slug shown at the domain's root (/), or none
  addedAt: string;
}
export type DomainMap = Record<string, DomainEntry>;

const ROW = 'domains';
const env = (k: string) => (process.env[k] || '').trim();

export class DomainError extends Error {
  userFacing = true;
}

// "https://Ofertas.MiTienda.com/x" → "ofertas.mitienda.com".
export function normalizeHost(input: string): string {
  const h = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)) throw new DomainError('Escribe un dominio válido, por ejemplo ofertas.mitienda.com o mitienda.com.');
  const main = mainHosts();
  if (main.some((m) => h === m || h.endsWith(`.${m}`)) || /(^|\.)vercel\.app$/.test(h) || /(^|\.)konnexa\.lat$/.test(h)) throw new DomainError('Ese dominio es de Konnexa. Usa uno tuyo.');
  return h;
}

// The platform's own hosts (the panel and the default landing links).
export function mainHosts(): string[] {
  const out = new Set<string>(['konnexa.lat', 'www.konnexa.lat', 'localhost']);
  try {
    const base = env('PUBLIC_BASE_URL') || env('NEXT_PUBLIC_SITE_URL');
    if (base) out.add(new URL(base).hostname.toLowerCase());
  } catch {}
  return Array.from(out);
}

export async function readDomains(): Promise<DomainMap> {
  const { data, error } = await rawDb().from('platform_settings').select('data').eq('id', ROW).maybeSingle();
  if (error) throw new Error(error.message);
  return ((data?.data as DomainMap) || {}) as DomainMap;
}

async function writeDomains(map: DomainMap) {
  const { error } = await rawDb().from('platform_settings').upsert({ id: ROW, data: map });
  if (error) throw new Error(error.message);
}

// ---------- Vercel ----------

const vercelOn = () => Boolean(env('VERCEL_TOKEN') && env('VERCEL_PROJECT_ID'));
async function vercel(method: string, path: string, body?: unknown) {
  const team = env('VERCEL_TEAM_ID');
  const url = `https://api.vercel.com${path}${team ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(team)}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${env('VERCEL_TOKEN')}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as any };
}

export interface DomainStatus {
  host: string;
  landing: string | null;
  addedAt: string;
  // ready: Vercel serves it with HTTPS; dns: the DNS record is missing or wrong; verify: Vercel asks for a TXT
  // record because the domain is used in another Vercel account; unknown: no Vercel token to ask.
  state: 'ready' | 'dns' | 'verify' | 'unknown';
  records: { type: string; name: string; value: string }[]; // what to add at the DNS provider
}

// The registrable domain: mitienda.com, or mitienda.com.co for second-level endings like .com.co.
function baseDomain(host: string): string {
  const p = host.split('.');
  const secondLevel = p.length >= 3 && /^(com|net|org|gov|edu|co|gob|ac)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2;
  return p.slice(secondLevel ? -3 : -2).join('.');
}

// The root domain (mitienda.com) points with an A record; a subdomain (ofertas.mitienda.com) with a CNAME.
export function dnsRecords(host: string): { type: string; name: string; value: string }[] {
  const base = baseDomain(host);
  if (host === base) return [{ type: 'A', name: '@', value: '76.76.21.21' }];
  return [{ type: 'CNAME', name: host.slice(0, -(base.length + 1)), value: 'cname.vercel-dns.com' }];
}

async function status(host: string, e: DomainEntry): Promise<DomainStatus> {
  const base = { host, landing: e.landing, addedAt: e.addedAt, records: dnsRecords(host) };
  if (!vercelOn()) return { ...base, state: 'unknown' };
  const pid = encodeURIComponent(env('VERCEL_PROJECT_ID'));
  const d = await vercel('GET', `/v9/projects/${pid}/domains/${encodeURIComponent(host)}`).catch(() => null);
  if (d?.ok && d.data?.verified === false && Array.isArray(d.data.verification) && d.data.verification.length) {
    return { ...base, state: 'verify', records: [...base.records, ...d.data.verification.map((v: any) => ({ type: String(v.type || 'TXT'), name: String(v.domain || '_vercel'), value: String(v.value || '') }))] };
  }
  const cfg = await vercel('GET', `/v6/domains/${encodeURIComponent(host)}/config`).catch(() => null);
  if (cfg?.ok && cfg.data?.misconfigured === false) return { ...base, state: 'ready' };
  return { ...base, state: 'dns' };
}

// ---------- the store's domains ----------

export async function domainsOf(org: string): Promise<DomainStatus[]> {
  const map = await readDomains();
  const mine = Object.entries(map).filter(([, e]) => e.org === org);
  return Promise.all(mine.map(([h, e]) => status(h, e)));
}

export async function addDomain(org: string, input: string): Promise<DomainStatus> {
  const host = normalizeHost(input);
  const map = await readDomains();
  if (map[host] && map[host].org !== org) throw new DomainError('Ese dominio ya está conectado a otra tienda.');
  if (Object.values(map).filter((e) => e.org === org).length >= 5 && !map[host]) throw new DomainError('Cada tienda puede conectar hasta 5 dominios.');
  if (vercelOn()) {
    const r = await vercel('POST', `/v10/projects/${encodeURIComponent(env('VERCEL_PROJECT_ID'))}/domains`, { name: host });
    // Already in this project is fine; anything else is explained.
    if (!r.ok && !/already|exists/i.test(JSON.stringify(r.data))) throw new DomainError(`Vercel no aceptó el dominio: ${r.data?.error?.message || `HTTP ${r.status}`}`);
  }
  map[host] = map[host] || { org, landing: null, addedAt: new Date().toISOString() };
  await writeDomains(map);
  return status(host, map[host]);
}

export async function setDomainLanding(org: string, input: string, slug: string | null) {
  const host = normalizeHost(input);
  const map = await readDomains();
  if (!map[host] || map[host].org !== org) throw new DomainError('Ese dominio no está en esta tienda.');
  if (slug !== null && !/^[a-z0-9-]{1,120}$/.test(slug)) throw new DomainError('Landing no válida.');
  if (slug) {
    const { data } = await rawDb().from('landings').select('id').eq('org_id', org).eq('slug', slug).maybeSingle();
    if (!data) throw new DomainError('Esa landing no es de esta tienda.');
  }
  map[host] = { ...map[host], landing: slug };
  await writeDomains(map);
}

export async function removeDomain(org: string, input: string) {
  const host = normalizeHost(input);
  const map = await readDomains();
  if (!map[host] || map[host].org !== org) throw new DomainError('Ese dominio no está en esta tienda.');
  if (vercelOn()) await vercel('DELETE', `/v9/projects/${encodeURIComponent(env('VERCEL_PROJECT_ID'))}/domains/${encodeURIComponent(host)}`).catch(() => null);
  delete map[host];
  await writeDomains(map);
}

export const vercelConnected = vercelOn;
