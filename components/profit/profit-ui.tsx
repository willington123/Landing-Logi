'use client';

// Small pieces shared by the Rentabilidad tabs.
import React from 'react';
import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import type { Receipt } from '@/lib/profit';

export const cop = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v < 0 ? '-' : ''}$${Math.round(Math.abs(v)).toLocaleString('es-CO')}`);
export const pctTxt = (v: number | null | undefined, digits = 0) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`);
export const roasTxt = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(2)}x`);
const upFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const dayTxt = (d: string) => upFirst(new Date(`${d}T12:00:00-05:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota' }).replace(/\./g, ''));
export const monthTxt = (m: string) => upFirst(new Date(`${m}-15T12:00:00-05:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' }));

export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw Object.assign(new Error(d.error || `HTTP ${res.status}`), { status: res.status });
  return d;
}

// Comprobante: straight from the browser to storage, then saved with the gasto / aporte.
export async function uploadReceipt(file: File): Promise<Receipt> {
  const mime = (file.type || 'application/octet-stream').split(';')[0];
  const up = await api<{ uploadUrl: string; path: string }>('/api/profit/receipt', { method: 'POST', body: JSON.stringify({ mime, size: file.size }) });
  const put = await fetch(up.uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: file });
  if (!put.ok) throw new Error(`No se pudo subir el comprobante (HTTP ${put.status}).`);
  return { path: up.path, name: file.name || 'comprobante', mime };
}
export const receiptUrl = (r: Receipt) => `/api/profit/receipt?path=${encodeURIComponent(r.path)}`;

export function ReceiptLink({ r }: { r: Receipt | null }) {
  if (!r) return <span className="text-slate-300">—</span>;
  return (
    <a href={receiptUrl(r)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-blue hover:underline" title={r.name}>
      <FileText className="w-3.5 h-3.5" /> Ver
    </a>
  );
}

export function ReceiptPicker({ file, current, onFile, onClear }: { file: File | null; current: Receipt | null; onFile: (f: File) => void; onClear: () => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const name = file?.name || current?.name;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} className="h-10 px-3 rounded-xl border border-slate-200 text-[13px] text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 shrink-0">
        <Paperclip className="w-4 h-4" /> {name ? 'Cambiar' : 'Comprobante'}
      </button>
      {name && (
        <span className="text-[12px] text-slate-600 truncate inline-flex items-center gap-1 min-w-0">
          <span className="truncate">{name}</span>
          <button type="button" onClick={onClear} className="p-1 text-slate-400 hover:text-red-600 shrink-0" aria-label="Quitar comprobante">
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}

export function Card({ title, children, right, className = '' }: { title?: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {(title || right) && (
        <div className="px-4 sm:px-5 pt-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
          {right}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, tone = 'slate' }: { label: string; value: string; sub?: React.ReactNode; tone?: 'slate' | 'green' | 'red' | 'violet' | 'sky' }) {
  const color = { slate: 'text-slate-900', green: 'text-emerald-700', red: 'text-red-600', violet: 'text-violet-700', sky: 'text-sky-700' }[tone];
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 min-w-0">
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-[22px] font-bold tabular-nums leading-tight ${color} truncate`}>{value}</p>
      {sub && <div className="mt-1 text-[12px] text-slate-500">{sub}</div>}
    </div>
  );
}

export const inputCls = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-slate-900/10';
export const labelCls = 'block text-[12px] font-medium text-slate-600 mb-1';
export const btnPrimary = 'h-10 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50';

export function Spinner() {
  return (
    <div className="flex justify-center py-16 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}

// "15.000" while typing; the server reads dots and commas as thousands.
export function MoneyInput({ value, onChange, placeholder = '0', id }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 12);
          onChange(digits ? Number(digits).toLocaleString('es-CO') : '');
        }}
        className={`${inputCls} pl-6 tabular-nums`}
      />
    </div>
  );
}
export const moneyValue = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
export const moneyText = (n: number) => (n ? n.toLocaleString('es-CO') : '');
