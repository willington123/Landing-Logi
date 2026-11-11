'use client';

// "Copiar para Dropi": each field of the order as Dropi's form asks for it (first name and last name apart,
// phone without +57, department and city as Dropi writes them, amount without dots), one tap per field,
// plus "Copiar todo". For uploading orders by hand while the Dropi API isn't available.
import React, { useState } from 'react';
import { Check, ChevronDown, Copy, Package } from 'lucide-react';
import { bulkCity, bulkDepartment } from '@/lib/dropi-bulk';

export interface DropiCopyOrder {
  orderNumber: string;
  customerName: string;
  phone: string;
  department: string;
  city: string;
  address: string;
  productName: string;
  comboName?: string;
  units?: number;
  totalAmount: number;
  notes?: string;
}

export function dropiFields(o: DropiCopyOrder): { label: string; value: string; warn?: string }[] {
  const [first, ...rest] = (o.customerName || '').trim().split(/\s+/);
  const phone = String(o.phone || '').replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, '');
  const dept = bulkDepartment(o.department, o.city);
  const city = bulkCity(o.city, dept);
  return [
    { label: 'Nombre', value: first || '' },
    { label: 'Apellido', value: rest.join(' '), warn: rest.length ? undefined : 'El cliente no dio apellido' },
    { label: 'Teléfono', value: phone, warn: phone.length < 10 ? 'Teléfono incompleto' : undefined },
    { label: 'Departamento', value: dept || o.department || '', warn: dept ? undefined : 'Dropi no tiene este departamento: revísalo' },
    { label: 'Ciudad', value: city || o.city || '', warn: dept && !city ? 'No está en las ciudades con recaudo de Dropi' : undefined },
    { label: 'Dirección', value: o.address || '', warn: o.address ? undefined : 'Falta la dirección' },
    { label: 'Producto', value: [o.productName, o.comboName].filter(Boolean).join(' · ') },
    ...(o.units ? [{ label: 'Cantidad', value: String(Math.max(1, o.units)) }] : []),
    { label: 'Valor a cobrar', value: String(Math.round(Number(o.totalAmount) || 0)) },
    { label: 'Notas', value: [o.notes, `Pedido ${o.orderNumber}`].filter(Boolean).join(' · ') },
  ];
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers or no permission: a hidden text box does it.
    const t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

export default function CopyForDropi({ order, defaultOpen = false }: { order: DropiCopyOrder; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState<string | null>(null);
  const fields = dropiFields(order);
  const copy = async (key: string, text: string) => {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    }
  };
  const all = fields.map((f) => `${f.label}: ${f.value}`).join('\n');

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/40">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        <Package className="w-4 h-4 text-orange-600 shrink-0" />
        <span className="flex-1 text-[13px] font-semibold text-slate-900">Copiar datos para Dropi</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          <p className="text-[11px] text-slate-500">Toca cada dato para copiarlo y pégalo en el campo igual de Dropi.</p>
          {fields.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => copy(f.label, f.value)}
              disabled={!f.value}
              title={`Copiar ${f.label.toLowerCase()}`}
              className="w-full flex items-center gap-2 rounded-lg bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 px-2.5 py-2 text-left disabled:opacity-60 transition"
            >
              <span className="w-24 shrink-0 text-[11px] font-medium text-slate-500">{f.label}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-slate-900 break-words">{f.value || '—'}</span>
                {f.warn && <span className="block text-[11px] text-amber-700">{f.warn}</span>}
              </span>
              {copied === f.label ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>
          ))}
          <button type="button" onClick={() => copy('*', all)} className="w-full h-9 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
            {copied === '*' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied === '*' ? 'Copiado' : 'Copiar todo'}
          </button>
        </div>
      )}
    </div>
  );
}
