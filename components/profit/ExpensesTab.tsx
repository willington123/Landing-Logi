'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { todayCo } from '@/components/ads/DateRangePicker';
import { AD_CHANNELS, EXPENSE_KINDS, type Expense, type ExpenseKind, type Receipt } from '@/lib/profit';
import type { ProfitData } from './ProfitPage';
import { Card, MoneyInput, ReceiptLink, ReceiptPicker, api, btnPrimary, cop, dayTxt, inputCls, labelCls, moneyText, moneyValue, uploadReceipt } from './profit-ui';

interface Form {
  id: string;
  kind: ExpenseKind;
  date: string;
  concept: string;
  amount: string;
  channel: string;
  productId: string;
  receipt: Receipt | null;
  createdAt?: string;
}
const blank = (): Form => ({ id: '', kind: 'ads', date: todayCo(), concept: '', amount: '', channel: 'tiktok', productId: '', receipt: null });

export default function ExpensesTab({ data, reload }: { data: ProfitData; reload: () => void }) {
  const { report, ledger, products, meta } = data;
  const [form, setForm] = useState<Form>(blank);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExpenseKind | ''>('');
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const name = (id: string | null) => (id ? products.find((x) => x.id === id)?.name || 'Producto borrado' : 'General');

  // Pauta of the period; tools and fixed costs of the months the period touches.
  const months = useMemo(() => new Set([report.since.slice(0, 7), report.until.slice(0, 7)]), [report.since, report.until]);
  const list = useMemo(
    () =>
      ledger.expenses
        .filter((e) => (e.kind === 'ads' ? e.date >= report.since && e.date <= report.until : months.has(e.date.slice(0, 7))))
        .filter((e) => !filter || e.kind === filter)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [ledger.expenses, report.since, report.until, months, filter],
  );
  const sum = (k: ExpenseKind) => list.filter((e) => e.kind === k).reduce((n, e) => n + e.amount, 0);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const receipt = file ? await uploadReceipt(file) : form.receipt;
      await api('/api/profit/ledger', {
        method: 'POST',
        body: JSON.stringify({
          type: 'expense',
          item: { id: form.id || undefined, kind: form.kind, date: form.date, concept: form.concept, amount: moneyValue(form.amount), channel: form.channel, productId: form.productId || null, receipt, createdAt: form.createdAt },
        }),
      });
      setForm({ ...blank(), kind: form.kind, date: form.date, channel: form.channel });
      setFile(null);
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const edit = (e: Expense) => {
    setForm({ id: e.id, kind: e.kind, date: e.date, concept: e.concept, amount: moneyText(e.amount), channel: e.channel || 'otro', productId: e.productId || '', receipt: e.receipt, createdAt: e.createdAt });
    setFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const remove = async (e: Expense) => {
    if (!confirm(`¿Borrar "${e.concept}" por ${cop(e.amount)}?`)) return;
    try {
      await api(`/api/profit/ledger?type=expense&id=${encodeURIComponent(e.id)}`, { method: 'DELETE' });
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <Card title={form.id ? 'Editar gasto' : 'Registrar gasto'}>
        <div className="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-label="Tipo de gasto">
          {EXPENSE_KINDS.map((k) => (
            <button key={k.id} role="radio" aria-checked={form.kind === k.id} onClick={() => set({ kind: k.id })} className={`h-9 px-3.5 rounded-xl text-[13px] font-semibold border ${form.kind === k.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-slate-500 mb-4">{EXPENSE_KINDS.find((k) => k.id === form.kind)?.hint}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelCls} htmlFor="ex-date">
              Fecha
            </label>
            <input id="ex-date" type="date" value={form.date} max={todayCo()} onChange={(e) => set({ date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="ex-amount">
              Valor
            </label>
            <MoneyInput id="ex-amount" value={form.amount} onChange={(v) => set({ amount: v })} />
          </div>
          {form.kind === 'ads' ? (
            <>
              <div>
                <label className={labelCls} htmlFor="ex-channel">
                  Plataforma
                </label>
                <select id="ex-channel" value={form.channel} onChange={(e) => set({ channel: e.target.value })} className={inputCls}>
                  {AD_CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="ex-product">
                  Producto
                </label>
                <select id="ex-product" value={form.productId} onChange={(e) => set({ productId: e.target.value })} className={inputCls}>
                  <option value="">General / varios</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="lg:col-span-2">
              <label className={labelCls} htmlFor="ex-concept">
                Concepto
              </label>
              <input id="ex-concept" value={form.concept} maxLength={120} onChange={(e) => set({ concept: e.target.value })} placeholder={form.kind === 'tool' ? 'Dropi, Shopify, Canva…' : 'Nómina asesora, arriendo…'} className={inputCls} />
            </div>
          )}
          {form.kind === 'ads' && (
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="ex-concept2">
                Detalle (opcional)
              </label>
              <input id="ex-concept2" value={form.concept} maxLength={120} onChange={(e) => set({ concept: e.target.value })} placeholder="Recarga TikTok, campaña de Google…" className={inputCls} />
            </div>
          )}
          <div className={form.kind === 'ads' ? 'sm:col-span-2 flex items-end' : 'sm:col-span-2 lg:col-span-4 flex items-end'}>
            <ReceiptPicker file={file} current={form.receipt} onFile={setFile} onClear={() => (setFile(null), set({ receipt: null }))} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={save} disabled={busy} className={btnPrimary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {form.id ? 'Guardar cambios' : 'Agregar gasto'}
          </button>
          {form.id && (
            <button onClick={() => (setForm(blank()), setFile(null))} className="h-10 px-3 rounded-xl text-[13px] font-medium text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
          )}
          {error && <p className="text-[13px] text-red-600">{error}</p>}
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniTotal label="Meta (automático)" value={meta.connected ? cop(report.total.adsMeta) : 'No conectado'} />
        <MiniTotal label="Otra pauta" value={cop(sum('ads'))} />
        <MiniTotal label="Herramientas del mes" value={cop(sum('tool'))} />
        <MiniTotal label="Gastos fijos del mes" value={cop(sum('fixed'))} />
      </div>

      <Card
        title="Gastos registrados"
        right={
          <select value={filter} onChange={(e) => setFilter(e.target.value as ExpenseKind | '')} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px]" aria-label="Filtrar por tipo">
            <option value="">Todos</option>
            {EXPENSE_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        }
      >
        {!list.length ? (
          <p className="text-[13px] text-slate-500 py-6 text-center">No hay gastos en este periodo.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-5">
            <table className="w-full text-[13px] min-w-[680px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="font-semibold px-4 sm:px-5 py-2">Fecha</th>
                  <th className="font-semibold px-2 py-2">Tipo</th>
                  <th className="font-semibold px-2 py-2">Concepto</th>
                  <th className="font-semibold px-2 py-2 text-right">Valor</th>
                  <th className="font-semibold px-2 py-2">Comprobante</th>
                  <th className="font-semibold px-4 sm:px-5 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 sm:px-5 py-2.5 whitespace-nowrap text-slate-700">{dayTxt(e.date)}</td>
                    <td className="px-2 py-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${e.kind === 'ads' ? 'bg-sky-50 text-sky-700' : e.kind === 'tool' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>
                        {e.kind === 'ads' ? AD_CHANNELS.find((c) => c.id === e.channel)?.label || 'Pauta' : EXPENSE_KINDS.find((k) => k.id === e.kind)?.label}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-slate-800">
                      {e.concept}
                      {e.kind === 'ads' && <span className="text-slate-400"> · {name(e.productId)}</span>}
                      {e.by && <span className="block text-[11px] text-slate-400">por {e.by}</span>}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-medium">{cop(e.amount)}</td>
                    <td className="px-2 py-2.5">
                      <ReceiptLink r={e.receipt} />
                    </td>
                    <td className="px-4 sm:px-5 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => edit(e)} className="p-2 text-slate-400 hover:text-slate-800" aria-label="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(e)} className="p-2 text-slate-400 hover:text-red-600" aria-label="Borrar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[12px] text-slate-500">La pauta de Meta se trae sola de tu cuenta publicitaria y no hay que cargarla aquí. Herramientas y gastos fijos se reparten entre los días de su mes.</p>
      </Card>
    </div>
  );
}

function MiniTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3">
      <p className="text-[12px] text-slate-500">{label}</p>
      <p className="text-[17px] font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
