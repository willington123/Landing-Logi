'use client';

// Urgency countdown for landings (see OfferCountdown in lib/types.ts).
import { useEffect, useState } from 'react';
import type { LandingPageConfig, OfferCountdown, ProductCombo } from '@/lib/types';

export const DEFAULT_COUNTDOWN: OfferCountdown = {
  enabled: false,
  mode: 'daily',
  hours: 24,
  text: '🔥 Oferta por tiempo limitado. Termina en:',
};

const COUNTRY_TZ: Record<string, string> = {
  Colombia: 'America/Bogota',
  Perú: 'America/Lima',
  Ecuador: 'America/Guayaquil',
  México: 'America/Mexico_City',
  Chile: 'America/Santiago',
  Guatemala: 'America/Guatemala',
  España: 'Europe/Madrid',
};

// Seconds until the next midnight in the given time zone.
export function secondsToMidnight(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  const elapsed = get('hour') * 3600 + get('minute') * 60 + get('second');
  return Math.max(1, 86400 - elapsed);
}

// The visitor's deadline, kept in their browser; a new one starts when it has passed.
function visitorDeadline(key: string, hours: number, now: number): number {
  const ms = Math.max(1, hours) * 3600 * 1000;
  try {
    const saved = Number(localStorage.getItem(key));
    if (saved > now && saved - now <= ms) return saved;
    const next = now + ms;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return now + ms; // storage blocked: count from this visit
  }
}

// Seconds left, or null while not started (avoids a server/browser mismatch) or when off.
export function useOfferCountdown(config: Pick<LandingPageConfig, 'id' | 'country' | 'countdown'>): number | null {
  const cd = config.countdown;
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!cd?.enabled) {
      setLeft(null);
      return;
    }
    const tz = COUNTRY_TZ[config.country || 'Colombia'] || 'America/Bogota';
    const key = `lp_cd_${config.id}_${cd.hours}`;
    const compute = () => {
      const now = Date.now();
      if (cd.mode === 'daily') return secondsToMidnight(new Date(now), tz);
      return Math.max(0, Math.round((visitorDeadline(key, cd.hours, now) - now) / 1000));
    };
    setLeft(compute());
    const t = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(t);
  }, [cd?.enabled, cd?.mode, cd?.hours, config.id, config.country]);

  return left;
}

export function splitTime(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { h: pad(h), m: pad(m), s: pad(s) };
}

// Offer selected when the page opens: the one marked as default, else the popular one, else the first.
export function defaultCombo(combos: ProductCombo[]): ProductCombo | undefined {
  return combos.find((c) => c.isDefault) || combos.find((c) => c.isPopular) || combos[0];
}
