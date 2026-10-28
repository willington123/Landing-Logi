'use client';

// Meta (Facebook) Pixel for public landing pages.
// Loads the official fbevents.js once per page and exposes a safe `trackPixel` helper.

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string };
    _fbq?: unknown;
  }
}

const initialized = new Set<string>();

export function isValidPixelId(id?: string): boolean {
  return Boolean(id && /^\d{10,20}$/.test(id.trim()));
}

export function initMetaPixel(pixelId: string) {
  if (typeof window === 'undefined' || !isValidPixelId(pixelId)) return;
  const id = pixelId.trim();
  if (!window.fbq) {
    // Official Meta base code (same behavior as the snippet Meta gives you).
    const n: any = function (...args: unknown[]) {
      n.callMethod ? n.callMethod(...args) : n.queue.push(args);
    };
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    window.fbq = n;
    if (!window._fbq) window._fbq = n;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  if (!initialized.has(id)) {
    window.fbq!('init', id);
    initialized.add(id);
    window.fbq!('track', 'PageView');
  }
}

type PixelEvent = 'ViewContent' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase' | 'Lead';

// eventID lets Meta deduplicate against a future server-side (Conversions API) event.
export function trackPixel(event: PixelEvent, params: Record<string, unknown> = {}, eventID?: string) {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (eventID) window.fbq('track', event, params, { eventID });
  else window.fbq('track', event, params);
}

// Sends an event only once per page load (guards against React re-running effects).
const sentOnce = new Set<string>();
export function trackPixelOnce(key: string, event: PixelEvent, params: Record<string, unknown> = {}) {
  if (sentOnce.has(key)) return;
  sentOnce.add(key);
  trackPixel(event, params);
}
