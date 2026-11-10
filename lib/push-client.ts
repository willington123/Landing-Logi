'use client';

// Notices on this device with Konnexa closed (Web Push). The browser gives a subscription; the server keeps it
// for the person signed in.
export type PushMode = 'all' | 'handoff';
export type PushState = { status: 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on'; mode: PushMode };

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

function supported(): PushState['status'] | null {
  if (typeof window === 'undefined') return 'unsupported';
  // iPhone only allows notices from the app installed on the home screen.
  if (isIos() && !standalone()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return null;
}

const keyBytes = (b64: string) => {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const api = async (method: string, body?: unknown, query = '') => {
  const res = await fetch(`/api/push${query}`, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
};
const registration = () => navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready);

export async function pushState(): Promise<PushState> {
  const no = supported();
  if (no) return { status: no, mode: 'all' };
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    if (!sub) return { status: 'off', mode: 'all' };
    const d = await api('GET', undefined, `?endpoint=${encodeURIComponent(sub.endpoint)}`);
    // Signed in as someone else on this device, or the server lost it: register it again quietly.
    if (!d.subscribed && Notification.permission === 'granted') {
      await api('POST', { subscription: sub.toJSON(), mode: 'all' });
      return { status: 'on', mode: 'all' };
    }
    return { status: d.subscribed ? 'on' : 'off', mode: d.mode === 'handoff' ? 'handoff' : 'all' };
  } catch {
    return { status: 'off', mode: 'all' };
  }
}

export async function enablePush(mode: PushMode = 'all'): Promise<PushState> {
  const no = supported();
  if (no) return { status: no, mode };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { status: perm === 'denied' ? 'blocked' : 'off', mode };
  const reg = await registration();
  const { publicKey } = await api('GET');
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another key can't be used: start again.
  const sameKey = sub?.options?.applicationServerKey && btoa(Array.from(new Uint8Array(sub.options.applicationServerKey), (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === publicKey;
  if (sub && !sameKey) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await api('POST', { subscription: sub.toJSON(), mode });
  return { status: 'on', mode };
}

export async function disablePush(): Promise<PushState> {
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) {
      await api('DELETE', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {}
  return { status: 'off', mode: 'all' };
}
