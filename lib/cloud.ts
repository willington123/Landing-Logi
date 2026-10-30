'use client';

// Keeps the panel's local cache (localStorage) in sync with Supabase when it is configured.
// Pages keep reading logiStore synchronously; this module pulls fresh data from the
// server and pushes changes back.
import { logiStore, StoreSettings } from './store';
import type { LandingPageConfig, OrderItem } from './types';

export const CLOUD_SYNC_EVENT = 'lp-cloud-synced';

let statusPromise: Promise<boolean> | null = null;
export function isCloud(): Promise<boolean> {
  if (!statusPromise) {
    statusPromise = fetch('/api/status')
      .then((r) => r.json())
      .then((d) => {
        const on = Boolean(d.cloud);
        (window as any).__lpCloud = on;
        return on;
      })
      .catch(() => false);
  }
  return statusPromise;
}

async function getJSON(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Downloads landings, orders and settings into the local cache.
export async function pullFromCloud(): Promise<boolean> {
  logiStore.purgeDemoData();
  if (!(await isCloud())) {
    window.dispatchEvent(new Event(CLOUD_SYNC_EVENT));
    return false;
  }
  try {
    const [l, o, st] = await Promise.all([getJSON('/api/landings'), getJSON('/api/orders'), getJSON('/api/settings')]);
    localStorage.setItem('logipages_landings', JSON.stringify(l.landings as LandingPageConfig[]));
    localStorage.setItem('logipages_orders', JSON.stringify(o.orders as OrderItem[]));
    if (st.settings) logiStore.saveStoreSettings({ ...logiStore.getStoreSettings(), ...(st.settings as StoreSettings) });
    window.dispatchEvent(new Event(CLOUD_SYNC_EVENT));
    return true;
  } catch (e) {
    console.error('No se pudo sincronizar con la nube:', e);
    return false;
  }
}

// The browser keeps a copy of the current store's data. With several stores (accounts),
// it is cleared on sign-in, sign-out and store switch so nobody sees another store's data.
// (Landings that only existed in the browser are no longer uploaded automatically.)
const KEEP = new Set(['logipages_gemini_api_key']);
export const ORG_KEY = 'lp_org';

export function clearLocalData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('logipages_') || k === ORG_KEY || k === 'lp_order_filters') && !KEEP.has(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('logipages_cloud_migrated', new Date().toISOString());
  } catch {
    // storage blocked: nothing cached
  }
}

// Called with the signed-in store: clears the cache if it belongs to another store. Returns true if it cleared.
export function ensureLocalOrg(orgId: string): boolean {
  try {
    const cached = localStorage.getItem(ORG_KEY);
    if (cached === orgId) return false;
    if (cached) clearLocalData();
    localStorage.setItem(ORG_KEY, orgId);
    localStorage.setItem('logipages_cloud_migrated', new Date().toISOString());
    return Boolean(cached);
  } catch {
    return false;
  }
}

// Saves a landing in Supabase. Returns the stored version (images as URLs) and the
// map of data URLs that were replaced.
export async function pushLanding(landing: LandingPageConfig): Promise<{ landing: LandingPageConfig; replaced: Record<string, string> } | null> {
  if (!(await isCloud())) return null;
  const res = await fetch('/api/landings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(landing) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
  return { landing: data.landing, replaced: data.replaced || {} };
}

export async function deleteLandingCloud(id: string) {
  if (!(await isCloud())) return;
  await fetch(`/api/landings/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function pushSettings(settings: StoreSettings) {
  if (!(await isCloud())) return;
  await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
}

// Deletes orders in Supabase (when configured), then from the local cache.
// Throws if the server refuses, so the panel never hides orders that still exist.
export async function deleteOrders(ids: string[]) {
  if (!ids.length) return;
  if (await isCloud()) {
    const res = await fetch('/api/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || `No se pudieron eliminar los pedidos (HTTP ${res.status}).`);
  }
  logiStore.deleteOrders(ids);
}

export function pushOrderStatus(id: string, status: OrderItem['status']) {
  if (typeof window === 'undefined' || !(window as any).__lpCloud) return;
  fetch(`/api/orders/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).catch(() => {});
}

// Replaces every string found in `map` (deep), used to swap uploaded data URLs for URLs.
export function swapStrings<T>(value: T, map: Record<string, string>): T {
  if (!Object.keys(map).length) return value;
  const walk = (v: any): any => {
    if (typeof v === 'string') return map[v] || v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value);
}
