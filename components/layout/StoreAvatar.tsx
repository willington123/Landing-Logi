'use client';

// A store's logo, or its initial on a color of its own when it has none (to tell stores apart).
import React, { useState } from 'react';

const COLORS = ['#0A6CF0', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];
const colorOf = (key: string) => COLORS[key.split('').reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];

export const STORE_LOGO_EVENT = 'lp:store-logo-changed';

export default function StoreAvatar({ name, logo, id, className = 'w-9 h-9 rounded-lg text-sm' }: { name: string; logo?: string | null; id?: string; className?: string }) {
  const [bad, setBad] = useState<string | null>(null);
  if (logo && bad !== logo)
    return <img src={logo} alt="" className={`${className} object-cover bg-white border border-slate-200 shrink-0`} onError={() => setBad(logo)} />;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={`${className} shrink-0 inline-flex items-center justify-center font-bold text-white`} style={{ background: colorOf(id || name || '?') }} aria-hidden>
      {initial}
    </span>
  );
}
