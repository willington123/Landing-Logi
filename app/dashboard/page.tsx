'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import { CallButton, useVapiReady } from '@/components/voice/CallButton';
import { logiStore } from '@/lib/store';
import { CLOUD_SYNC_EVENT } from '@/lib/cloud';
import { LandingPageConfig, OrderItem, VoiceCallTask } from '@/lib/types';
import {
  Sparkles,
  ShoppingBag,
  PhoneCall,
  MessageSquare,
  TrendingUp,
  ArrowUpRight,
  ExternalLink,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Layers,
  ChevronRight,
  Flame,
  ShieldCheck,
  Plus,
  PenSquare,
} from 'lucide-react';

export default function DashboardPage() {
  const [landings, setLandings] = useState<LandingPageConfig[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const vapiReady = useVapiReady();

  const refreshData = () => {
    setLandings(logiStore.getLandings());
    setOrders(logiStore.getOrders());
  };

  useEffect(() => {
    refreshData();
    // Re-read when fresh data arrives from Supabase.
    window.addEventListener(CLOUD_SYNC_EVENT, refreshData);
    return () => window.removeEventListener(CLOUD_SYNC_EVENT, refreshData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const confirmedOrdersCount = orders.filter((o) => o.status === 'confirmed_by_voice').length;
  const pendingCallsCount = orders.filter((o) => o.status === 'pending_call' || o.status === 'calling').length;
  const confirmationRate = orders.length > 0 ? Math.round((confirmedOrdersCount / orders.length) * 100) : 0;

  const money = (v: number) => `$${v.toLocaleString('es-CO')}`;
  const statusChip: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
    confirmed_by_voice: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', Icon: CheckCircle2 },
    pending_call: { label: 'Por llamar', cls: 'bg-amber-50 text-amber-700 ring-amber-600/15', Icon: Clock },
    needs_review: { label: 'Revisar', cls: 'bg-blue-50 text-blue-700 ring-blue-600/15', Icon: AlertCircle },
    cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-600 ring-slate-500/15', Icon: AlertCircle },
  };

  const stats = [
    { label: 'Pedidos', value: orders.length.toString(), hint: 'Capturados en tus landings', Icon: ShoppingBag, tone: 'text-brand-navy bg-brand-navy/[0.07]' },
    { label: 'Confirmados por IA', value: confirmedOrdersCount.toString(), hint: `${confirmationRate}% de confirmación`, Icon: PhoneCall, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Ventas contraentrega', value: money(totalRevenue), hint: 'COP en pedidos activos', Icon: TrendingUp, tone: 'text-brand-blue bg-brand-blue/[0.07]' },
    { label: 'Llamadas en cola', value: pendingCallsCount.toString(), hint: 'Pedidos por confirmar', Icon: Clock, tone: 'text-amber-600 bg-amber-50' },
  ];

  const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Inicio" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 max-w-[1280px] mx-auto w-full">
          {/* Welcome */}
          <section className={`${card} relative overflow-hidden p-6 sm:p-8`}>
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-brand-green/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 right-40 w-72 h-72 rounded-full bg-brand-navy/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-slate-500 mb-1">Bienvenido de nuevo 👋</p>
                <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 leading-tight">
                  Sube una foto y ten tu próxima landing lista en minutos
                </h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  La IA escribe los textos, elige los colores y crea las imágenes. Los pedidos llegan aquí y el agente de voz los confirma.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 flex-shrink-0">
                <button
                  onClick={() => setIsWizardOpen(true)}
                  className="h-11 px-5 rounded-xl bg-brand-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_10px_24px_-10px_rgba(10,108,240,0.7)] hover:brightness-105 active:scale-[0.98] transition"
                >
                  <Sparkles className="w-4 h-4" />
                  Crear landing con IA
                </button>
                <Link
                  href="/voice-ai"
                  className="h-11 px-5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 hover:border-slate-300 hover:bg-slate-50 transition"
                >
                  <Play className="w-4 h-4 text-emerald-600" />
                  Llamadas IA
                </Link>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {stats.map(({ label, value, hint, Icon, tone }) => (
              <div key={label} className={`${card} p-4 sm:p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-medium text-slate-500">{label}</span>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 tabular-nums">{value}</div>
                <p className="text-xs text-slate-400 mt-1">{hint}</p>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              {/* Landings */}
              <section className={card}>
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <h3 className="text-[15px] font-semibold text-slate-900">Tus landing pages</h3>
                  <Link href="/landings" className="text-[13px] font-medium text-brand-navy hover:underline flex items-center gap-0.5">
                    Ver todas ({landings.length}) <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                {landings.length === 0 ? (
                  <div className="px-5 pb-6 text-center">
                    <p className="text-sm text-slate-500 mb-3">Aún no tienes landings.</p>
                    <button onClick={() => setIsWizardOpen(true)} className="text-sm font-semibold text-brand-blue">
                      Crear la primera
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {landings.slice(0, 4).map((landing) => (
                      <li key={landing.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition">
                        <img
                          src={landing.mainImage}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{landing.productName}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            <span className="font-medium text-slate-700">
                              {money(landing.promoPrice)} {landing.currency}
                            </span>
                            {' · '}
                            {landing.viewsCount} visitas · {landing.ordersCount} pedidos
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Link
                            href={`/landings/editor/${landing.id}`}
                            className="h-8 px-3 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-white hover:border-slate-300 flex items-center gap-1.5 transition"
                          >
                            <PenSquare className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Editar</span>
                          </Link>
                          <a
                            href={landing.publishedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 flex items-center justify-center transition"
                            aria-label="Ver landing publicada"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Orders */}
              <section className={card}>
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <h3 className="text-[15px] font-semibold text-slate-900">Últimos pedidos</h3>
                  <Link href="/orders" className="text-[13px] font-medium text-brand-navy hover:underline flex items-center gap-0.5">
                    Ver pedidos <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs font-medium text-slate-400 border-y border-slate-100 bg-slate-50/60">
                        <th className="px-5 py-2.5 font-medium">Pedido</th>
                        <th className="px-3 py-2.5 font-medium">Cliente</th>
                        <th className="px-3 py-2.5 font-medium hidden md:table-cell">Ciudad</th>
                        <th className="px-3 py-2.5 font-medium text-right">Total</th>
                        <th className="px-3 py-2.5 font-medium">Estado</th>
                        <th className="px-5 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 5).map((order) => {
                        const chip = statusChip[order.status] || { label: order.status, cls: 'bg-slate-100 text-slate-600 ring-slate-500/15', Icon: Clock };
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3 font-mono text-[13px] text-slate-500">{order.orderNumber}</td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-slate-900 whitespace-nowrap">{order.customerName}</p>
                              <p className="text-xs text-slate-400">{order.phone}</p>
                            </td>
                            <td className="px-3 py-3 text-slate-600 hidden md:table-cell">{order.city}</td>
                            <td className="px-3 py-3 text-right font-semibold text-slate-900 tabular-nums">{money(order.totalAmount)}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap ${chip.cls}`}>
                                <chip.Icon className="w-3 h-3" />
                                {chip.label}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <CallButton order={order} variant="icon" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <section className={`${card} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-semibold text-slate-900">Llamadas IA</h3>
                  {vapiReady === null ? null : vapiReady ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Conectado</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">Sin conectar</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  {vapiReady
                    ? 'Un agente de voz con IA llama a tus clientes, confirma el pedido y la dirección, y actualiza el estado solo.'
                    : 'Conecta Vapi para que un agente de voz con IA llame a tus clientes y confirme cada pedido.'}
                </p>
                <Link
                  href="/voice-ai"
                  className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
                >
                  <PhoneCall className="w-4 h-4" />
                  {vapiReady ? 'Ver llamadas' : 'Configurar llamadas'}
                </Link>
              </section>

              <section className={`${card} p-5`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-[#25D366]/10 text-[#128C4B] flex items-center justify-center">
                    <MessageSquare className="w-[18px] h-[18px]" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">Mensajes</h3>
                    <p className="text-xs text-slate-500">WhatsApp Business</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  Las respuestas de tus clientes por WhatsApp llegan aquí, con su pedido al lado. Se activa al conectar WhatsApp en Integraciones.
                </p>
                <Link
                  href="/crm"
                  className="w-full h-10 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-50 hover:border-slate-300 transition"
                >
                  Abrir bandeja <ArrowUpRight className="w-4 h-4" />
                </Link>
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Modals */}
      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onGenerated={() => refreshData()}
      />


    </div>
  );
}
