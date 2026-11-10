'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ProfitData } from './ProfitPage';
import { Card, MoneyInput, api, btnPrimary, cop, inputCls, labelCls, moneyText, moneyValue, pctTxt } from './profit-ui';

// What each sale costs: delivery rate, freight, commissions, product cost, and which product each Meta campaign sells.
export default function CostsTab({ data, reload }: { data: ProfitData; reload: () => void }) {
  const { config, products, report } = data;
  const [rate, setRate] = useState(String(config.deliveryRate));
  const [shipping, setShipping] = useState(moneyText(config.shipping));
  const [returnShipping, setReturnShipping] = useState(moneyText(config.returnShipping));
  const [fixed, setFixed] = useState(moneyText(config.commissionFixed));
  const [percent, setPercent] = useState(config.commissionPercent ? String(config.commissionPercent) : '');
  const [costs, setCosts] = useState<Record<string, string>>(() => Object.fromEntries(products.map((p) => [p.id, moneyText(config.productCosts[p.id] || 0)])));
  const [camps, setCamps] = useState<Record<string, string>>(() => ({ ...config.campaignProducts }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const real = report.total.deliveryRateReal;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const productCosts = Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, moneyValue(v)]).filter(([, v]) => Number(v) > 0));
      const campaignProducts = Object.fromEntries(Object.entries(camps).filter(([, v]) => v));
      await api('/api/profit/config', {
        method: 'PUT',
        body: JSON.stringify({ deliveryRate: Number(rate.replace(',', '.')) || 0, shipping: moneyValue(shipping), returnShipping: moneyValue(returnShipping), commissionFixed: moneyValue(fixed), commissionPercent: Number(percent.replace(',', '.')) || 0, productCosts, campaignProducts }),
      });
      setMsg({ ok: true, text: 'Guardado. La rentabilidad ya usa estos costos.' });
      reload();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card title="Entregas, fletes y comisiones">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className={labelCls} htmlFor="c-rate">
              % de entrega esperado
            </label>
            <div className="relative">
              <input id="c-rate" value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))} className={`${inputCls} pr-7 tabular-nums`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
            </div>
            {real !== null && <p className="mt-1 text-[11px] text-slate-500">Real del periodo: {pctTxt(real)}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="c-ship">
              Flete por envío
            </label>
            <MoneyInput id="c-ship" value={shipping} onChange={setShipping} />
          </div>
          <div>
            <label className={labelCls} htmlFor="c-ret">
              Flete extra por devolución
            </label>
            <MoneyInput id="c-ret" value={returnShipping} onChange={setReturnShipping} />
          </div>
          <div>
            <label className={labelCls} htmlFor="c-fixed">
              Comisión fija por entrega
            </label>
            <MoneyInput id="c-fixed" value={fixed} onChange={setFixed} />
          </div>
          <div>
            <label className={labelCls} htmlFor="c-pct">
              Comisión % del recaudo
            </label>
            <div className="relative">
              <input id="c-pct" value={percent} inputMode="decimal" placeholder="0" onChange={(e) => setPercent(e.target.value.replace(/[^\d.,]/g, ''))} className={`${inputCls} pr-7 tabular-nums`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-slate-500">
          El % de entrega se usa para la utilidad proyectada: de cada 100 confirmados, cuántos llegan y se cobran. Si marcas los pedidos como Entregado o Devuelto, verás tu % real.
        </p>
      </Card>

      <Card title="Costo de cada producto">
        {!products.length ? (
          <p className="text-[13px] text-slate-500">Aún no tienes productos. Crea una landing o un producto de WhatsApp.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {products.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center gap-3">
                <span className="flex-1 min-w-0 text-[13px] font-medium text-slate-900 truncate">{p.name}</span>
                <div className="w-40 shrink-0">
                  <MoneyInput value={costs[p.id] || ''} onChange={(v) => setCosts((c) => ({ ...c, [p.id]: v }))} placeholder="Costo por unidad" />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[12px] text-slate-500">Lo que te cuesta cada unidad (precio del proveedor o de Dropi). Se multiplica por las unidades de cada pedido.</p>
      </Card>

      {report.campaigns.length > 0 && (
        <Card title="Campañas de Meta del periodo">
          <p className="text-[12px] text-slate-500 mb-3">Konnexa asigna la pauta al producto de los pedidos que trajo cada anuncio. Para campañas que aún no traen pedidos, elige aquí su producto.</p>
          <div className="divide-y divide-slate-100">
            {report.campaigns.map((c) => (
              <div key={c.campaign} className="py-2.5 flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-[160px] text-[13px] text-slate-900">
                  {c.campaign || 'Sin nombre'} <span className="text-slate-400 tabular-nums">· {cop(c.spend)}</span>
                </span>
                <select value={camps[c.campaign] || ''} onChange={(e) => setCamps((m) => ({ ...m, [c.campaign]: e.target.value }))} className="h-10 w-56 max-w-full rounded-xl border border-slate-200 bg-white px-2 text-[13px]" aria-label={`Producto de ${c.campaign}`}>
                  <option value="">Automático (por pedidos)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 sticky bottom-20 md:bottom-4">
        <button onClick={save} disabled={busy} className={`${btnPrimary} shadow-lg`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar costos
        </button>
        {msg && <p className={`text-[13px] ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
