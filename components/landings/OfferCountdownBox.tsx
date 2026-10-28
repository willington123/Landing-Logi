'use client';

// Countdown shown on the landing (buy box and order form).
import React from 'react';
import type { LandingPageConfig } from '@/lib/types';
import { splitTime, useOfferCountdown } from '@/lib/offer-countdown';

interface Props {
  config: Pick<LandingPageConfig, 'id' | 'country' | 'countdown'>;
  dark: string;
  accent: string;
  compact?: boolean;
}

export default function OfferCountdownBox({ config, dark, accent, compact = false }: Props) {
  const left = useOfferCountdown(config);
  if (!config.countdown?.enabled || left === null) return null;
  const { h, m, s } = splitTime(left);
  const text = config.countdown.text?.trim();

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold" style={{ background: `${accent}1A`, color: dark }}>
        {text && <span className="truncate">{text}</span>}
        <span className="tabular-nums font-bold whitespace-nowrap">
          {h}:{m}:{s}
        </span>
      </div>
    );
  }

  const Tile = ({ v, label }: { v: string; label: string }) => (
    <div className="flex flex-col items-center">
      <span className="min-w-[52px] rounded-lg px-2 py-1.5 text-2xl font-bold tabular-nums text-white text-center" style={{ background: dark }}>
        {v}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );

  return (
    <div className="mt-5 rounded-2xl border-2 px-4 py-3" style={{ borderColor: accent, background: `${accent}12` }} role="timer" aria-live="off">
      {text && <p className="text-center text-sm font-semibold mb-2" style={{ color: dark }}>{text}</p>}
      <div className="flex items-start justify-center gap-2">
        <Tile v={h} label="Horas" />
        <span className="text-2xl font-bold pt-1.5" style={{ color: dark }}>:</span>
        <Tile v={m} label="Min" />
        <span className="text-2xl font-bold pt-1.5" style={{ color: dark }}>:</span>
        <Tile v={s} label="Seg" />
      </div>
    </div>
  );
}
