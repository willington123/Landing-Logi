'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { todayCo } from '@/components/ads/DateRangePicker';
import { NO_PRODUCT, type Budget, type Contribution, type Partner, type Receipt } from '@/lib/profit';
import type { ProfitData } from './ProfitPage';
import { Card, MoneyInput, ReceiptLink, ReceiptPicker, Spinner, api, btnPrimary, cop, dayTxt, inputCls, labelCls, monthTxt, moneyValue, pctTxt, roasTxt, uploadReceipt } from './profit-ui';

const lastMonths = (n: number) => {
  const t = todayCo();
  let y = Number(t.slice(0, 4));
  let m = Number(t.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m--;
    if (!m) (m = 12), y--;
  }
  return out;
};
const monthEnd = (ym: string) => {
  const end = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return end > todayCo() ? todayCo() : end;
};

// Budget per product and partners: for one month (its own report).
export default function InvestmentTab({ data: base, reloadAll }: { data: ProfitData; reloadAll: () => void }) {
  const months = useMemo(() => lastMonths(13), []);
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState<ProfitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (m: string) => {
    try {
      setError(null);
      setData(await api<ProfitData>(`/api/profit?range=custom&since=${m}-01&until=${monthEnd(m)}`));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load(month);
  }, [month, load]);
  const reload = () => (load(month), reloadAll());

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <label htmlFor="inv-month" className="text-[13px] font-medium text-slate-600">
          Mes
        </label>
        <select id="inv-month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px]">
          {months.map((m) => (
            <option key={m} value={m} >
              {monthTxt(m)}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      {!data ? (
        <Spinner />
      ) : (
        <>
          <Budgets data={data} month={month} reload={reload} />
          <Partners data={data} month={month} reload={reload} products={base.products} />
        </>
      )}
    </div>
  );
}

function Budgets({ data, month, reload }: { data: ProfitData; month: string; reload: () => void }) {
  const { report, ledger, products } = data;
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const budgets = ledger.budgets.filter((b) => b.month === month);
  const name = (id: string | null) => (!id || id === NO_PRODUCT ? 'General / varios' : products.find((x) => x.id === id)?.name || 'Producto borrado');
  const line = (id: string | null) => report.products.find((p) => p.productId === (id || NO_PRODUCT));
  // Products with a budget or with spend this month.
  const rows = Array.from(new Set([...budgets.map((b) => b.productId || NO_PRODUCT), ...report.products.filter((p) => p.ads > 0).map((p) => p.productId)])).map((id) => {
    const pid = id === NO_PRODUCT ? null : id;
    const b = budgets.find((x) => (x.productId || null) === pid) || null;
    const l = line(pid);
    return { id, pid, budget: b, assigned: b?.amount || 0, spent: l?.ads || 0, sales: l?.confirmedRevenue || 0, confirmed: l?.confirmed || 0, roas: l?.roas ?? null, profit: l?.projected.profit ?? 0 };
  });
  const totals = rows.reduce((a, r) => ({ assigned: a.assigned + r.assigned, spent: a.spent + r.spent, sales: a.sales + r.sales }), { assigned: 0, spent: 0, sales: 0 });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const existing = budgets.find((b) => (b.productId || '') === productId);
      await api('/api/profit/ledger', { method: 'POST', body: JSON.stringify({ type: 'budget', item: { id: existing?.id, month, productId: productId || null, amount: moneyValue(amount), note } }) });
      setAmount('');
      setNote('');
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (b: Budget) => {
    if (!confirm(`¿Quitar el presupuesto de ${name(b.productId)}?`)) return;
    await api(`/api/profit/ledger?type=budget&id=${encodeURIComponent(b.id)}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    reload();
  };

  return (
    <Card title={`Presupuesto de pauta · ${monthTxt(month)}`}>
      <p className="text-[12px] text-slate-500 mb-4">Asigna cuánto vas a invertir en pauta por producto este mes y compáralo con lo gastado y lo vendido.</p>
      <div className="grid sm:grid-cols-[1.4fr_1fr_1.4fr_auto] gap-3 items-end">
        <div>
          <label className={labelCls} htmlFor="bud-product">
            Producto
          </label>
          <select id="bud-product" value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
            <option value="">General / varios</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="bud-amount">
            Inversión del mes
          </label>
          <MoneyInput id="bud-amount" value={amount} onChange={setAmount} />
        </div>
        <div>
          <label className={labelCls} htmlFor="bud-note">
            Nota (opcional)
          </label>
          <input id="bud-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Prueba de 3 creativos…" className={inputCls} />
        </div>
        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Asignar
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}

      <div className="mt-5 overflow-x-auto -mx-4 sm:-mx-5">
        <table className="w-full text-[13px] min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="font-semibold px-4 sm:px-5 py-2">Producto</th>
              <th className="font-semibold px-2 py-2 text-right">Asignado</th>
              <th className="font-semibold px-2 py-2 text-right">Gastado</th>
              <th className="font-semibold px-2 py-2 w-40">Uso</th>
              <th className="font-semibold px-2 py-2 text-right">Ventas conf.</th>
              <th className="font-semibold px-2 py-2 text-right">ROAS</th>
              <th className="font-semibold px-2 py-2 text-right">Utilidad proy.</th>
              <th className="px-4 sm:px-5 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const used = r.assigned ? r.spent / r.assigned : null;
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 sm:px-5 py-2.5 font-medium text-slate-900">
                    {name(r.pid)}
                    {r.budget?.note && <span className="block text-[11px] font-normal text-slate-400">{r.budget.note}</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{r.assigned ? cop(r.assigned) : <span className="text-slate-400">Sin asignar</span>}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{cop(r.spent)}</td>
                  <td className="px-2 py-2.5">
                    {used !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${used > 1 ? 'bg-red-500' : used > 0.85 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, used * 100)}%` }} />
                        </div>
                        <span className={`text-[12px] tabular-nums ${used > 1 ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>{pctTxt(used)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{cop(r.sales)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{roasTxt(r.roas)}</td>
                  <td className={`px-2 py-2.5 text-right tabular-nums font-semibold ${r.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{cop(r.profit)}</td>
                  <td className="px-4 sm:px-5 py-2.5 text-right">
                    {r.budget && (
                      <button onClick={() => remove(r.budget!)} className="p-2 text-slate-400 hover:text-red-600" aria-label="Quitar presupuesto">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-500">
                  Aún no hay presupuesto ni pauta este mes.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold">
                <td className="px-4 sm:px-5 py-2.5">Total</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{cop(totals.assigned)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{cop(totals.spent)}</td>
                <td className="px-2 py-2.5 text-[12px] text-slate-600">{totals.assigned ? pctTxt(totals.spent / totals.assigned) : ''}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{cop(totals.sales)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}

function Partners({ data, month, reload }: { data: ProfitData; month: string; reload: () => void; products: { id: string; name: string }[] }) {
  const { ledger, partners: shares, report } = data;
  const [pName, setPName] = useState('');
  const [pShare, setPShare] = useState('');
  const [c, setC] = useState<{ partnerId: string; date: string; amount: string; note: string }>({ partnerId: '', date: todayCo(), amount: '', note: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'' | 'partner' | 'contribution'>('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'projected' | 'real'>('projected');
  const partnerName = (id: string) => ledger.partners.find((p) => p.id === id)?.name || '—';

  const post = async (type: string, item: unknown) => api('/api/profit/ledger', { method: 'POST', body: JSON.stringify({ type, item }) });
  const addPartner = async () => {
    setBusy('partner');
    setError(null);
    try {
      await post('partner', { name: pName, share: pShare === '' ? null : Number(pShare) });
      setPName('');
      setPShare('');
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };
  const setShare = async (p: Partner, v: string) => {
    try {
      await post('partner', { ...p, share: v === '' ? null : Number(v) });
      reload();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const addContribution = async () => {
    setBusy('contribution');
    setError(null);
    try {
      const receipt: Receipt | null = file ? await uploadReceipt(file) : null;
      await post('contribution', { partnerId: c.partnerId || ledger.partners[0]?.id, date: c.date, amount: moneyValue(c.amount), note: c.note, receipt });
      setC({ ...c, amount: '', note: '' });
      setFile(null);
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };
  const del = async (type: 'partner' | 'contribution', id: string, label: string) => {
    if (!confirm(`¿Borrar ${label}?`)) return;
    try {
      await api(`/api/profit/ledger?type=${type}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      reload();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const fixedTotal = ledger.partners.reduce((n, p) => n + (p.share || 0), 0);
  const profit = report.total[mode].profit;
  const list: Contribution[] = [...ledger.contributions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card title="Socios y aportes">
      <p className="text-[12px] text-slate-500 mb-4">
        Registra quién puso dinero. La utilidad se reparte por el % que acordaron; si no pones %, se reparte en proporción a lo que cada uno aportó.
      </p>
      {error && <p className="mb-3 text-[13px] text-red-600">{error}</p>}

      {ledger.partners.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[13px] text-slate-600">
              Utilidad {mode === 'projected' ? 'proyectada' : 'real'} de {monthTxt(month)}: <b className={profit >= 0 ? 'text-emerald-700' : 'text-red-600'}>{cop(profit)}</b>
            </p>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[12px] font-semibold">
              {(
                [
                  ['projected', 'Proyectada'],
                  ['real', 'Real'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => setMode(id)} aria-pressed={mode === id} className={`h-8 px-3 rounded-md ${mode === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 sm:-mx-5">
            <table className="w-full text-[13px] min-w-[620px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="font-semibold px-4 sm:px-5 py-2">Socio</th>
                  <th className="font-semibold px-2 py-2 text-right">Ha aportado</th>
                  <th className="font-semibold px-2 py-2 text-right">% del capital</th>
                  <th className="font-semibold px-2 py-2 w-36">% de utilidad</th>
                  <th className="font-semibold px-2 py-2 text-right">Le corresponde</th>
                  <th className="px-4 sm:px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {shares[mode].map((s) => {
                  const p = ledger.partners.find((x) => x.id === s.partnerId)!;
                  return (
                    <tr key={s.partnerId} className="border-t border-slate-100">
                      <td className="px-4 sm:px-5 py-2.5 font-medium text-slate-900">{s.name}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{cop(s.contributed)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{s.contributedPct.toFixed(0)}%</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1">
                          <input
                            defaultValue={p.share ?? ''}
                            placeholder={`${s.share.toFixed(0)} (auto)`}
                            inputMode="decimal"
                            onBlur={(e) => e.target.value !== String(p.share ?? '') && setShare(p, e.target.value.replace(',', '.'))}
                            className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-[13px] tabular-nums"
                            aria-label={`% de utilidad de ${s.name}`}
                          />
                          <span className="text-slate-400">%</span>
                        </div>
                      </td>
                      <td className={`px-2 py-2.5 text-right tabular-nums font-semibold ${s.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{cop(s.profit)}</td>
                      <td className="px-4 sm:px-5 py-2.5 text-right">
                        <button onClick={() => del('partner', p.id, `a ${p.name}`)} className="p-2 text-slate-400 hover:text-red-600" aria-label={`Borrar a ${p.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {fixedTotal > 100 && <p className="mt-2 text-[12px] text-red-600">Los % acordados suman {fixedTotal}%: deberían sumar 100% o menos.</p>}
        </>
      )}

      <div className="mt-4 grid sm:grid-cols-[1.5fr_1fr_auto] gap-3 items-end">
        <div>
          <label className={labelCls} htmlFor="par-name">
            Nuevo socio
          </label>
          <input id="par-name" value={pName} maxLength={60} onChange={(e) => setPName(e.target.value)} placeholder="Nombre" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="par-share">
            % de utilidad (opcional)
          </label>
          <input id="par-share" value={pShare} inputMode="decimal" onChange={(e) => setPShare(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="Según aportes" className={inputCls} />
        </div>
        <button onClick={addPartner} disabled={busy !== ''} className={btnPrimary}>
          {busy === 'partner' && <Loader2 className="w-4 h-4 animate-spin" />} Agregar socio
        </button>
      </div>

      {ledger.partners.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-[14px] font-semibold text-slate-900 mb-3">Registrar aporte</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={labelCls} htmlFor="con-partner">
                Socio
              </label>
              <select id="con-partner" value={c.partnerId || ledger.partners[0]?.id} onChange={(e) => setC({ ...c, partnerId: e.target.value })} className={inputCls}>
                {ledger.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="con-date">
                Fecha
              </label>
              <input id="con-date" type="date" value={c.date} max={todayCo()} onChange={(e) => setC({ ...c, date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="con-amount">
                Valor
              </label>
              <MoneyInput id="con-amount" value={c.amount} onChange={(v) => setC({ ...c, amount: v })} />
            </div>
            <div>
              <label className={labelCls} htmlFor="con-note">
                Nota (opcional)
              </label>
              <input id="con-note" value={c.note} maxLength={200} onChange={(e) => setC({ ...c, note: e.target.value })} placeholder="Para pauta de noviembre…" className={inputCls} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ReceiptPicker file={file} current={null} onFile={setFile} onClear={() => setFile(null)} />
            <button onClick={addContribution} disabled={busy !== ''} className={btnPrimary}>
              {busy === 'contribution' && <Loader2 className="w-4 h-4 animate-spin" />} Agregar aporte
            </button>
          </div>

          {list.length > 0 && (
            <div className="mt-5 overflow-x-auto -mx-4 sm:-mx-5">
              <table className="w-full text-[13px] min-w-[560px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="font-semibold px-4 sm:px-5 py-2">Fecha</th>
                    <th className="font-semibold px-2 py-2">Socio</th>
                    <th className="font-semibold px-2 py-2">Nota</th>
                    <th className="font-semibold px-2 py-2 text-right">Valor</th>
                    <th className="font-semibold px-2 py-2">Comprobante</th>
                    <th className="px-4 sm:px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((x) => (
                    <tr key={x.id} className="border-t border-slate-100">
                      <td className="px-4 sm:px-5 py-2.5 whitespace-nowrap text-slate-700">{dayTxt(x.date)}</td>
                      <td className="px-2 py-2.5 font-medium text-slate-900">{partnerName(x.partnerId)}</td>
                      <td className="px-2 py-2.5 text-slate-600">{x.note || '—'}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-medium">{cop(x.amount)}</td>
                      <td className="px-2 py-2.5">
                        <ReceiptLink r={x.receipt} />
                      </td>
                      <td className="px-4 sm:px-5 py-2.5 text-right">
                        <button onClick={() => del('contribution', x.id, `el aporte de ${cop(x.amount)}`)} className="p-2 text-slate-400 hover:text-red-600" aria-label="Borrar aporte">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
