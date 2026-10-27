'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import { VoiceCallSimulatorModal } from '@/components/voice/VoiceCallSimulatorModal';
import { logiStore } from '@/lib/store';
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
} from 'lucide-react';

export default function DashboardPage() {
  const [landings, setLandings] = useState<LandingPageConfig[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [callTasks, setCallTasks] = useState<VoiceCallTask[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [activeSimTask, setActiveSimTask] = useState<VoiceCallTask | null>(null);

  const refreshData = () => {
    setLandings(logiStore.getLandings());
    setOrders(logiStore.getOrders());
    setCallTasks(logiStore.getCallTasks());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const confirmedOrdersCount = orders.filter((o) => o.status === 'confirmed_by_voice').length;
  const pendingCallsCount = orders.filter((o) => o.status === 'pending_call' || o.status === 'calling').length;
  const confirmationRate = orders.length > 0 ? Math.round((confirmedOrdersCount / orders.length) * 100) : 0;

  const handleTestCall = (order?: OrderItem) => {
    if (order) {
      const task = callTasks.find((c) => c.orderId === order.id) || {
        id: `call-${Date.now()}`,
        orderId: order.id,
        customerName: order.customerName,
        phone: order.phone,
        status: order.status,
        attempts: 1,
        maxAttempts: 3,
        durationSeconds: 0,
        transcript: [],
      };
      setActiveSimTask(task);
    } else {
      setActiveSimTask(callTasks[0] || null);
    }
    setIsSimulatorOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Panel de Control General" />

        <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Welcome & Primary CTA Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-navyDark via-[#152777] to-brand-navy p-6 md:p-8 text-white shadow-xl">
            {/* Background Glow Spheres */}
            <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-brand-red/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-40 -top-10 w-48 h-48 bg-brand-orange/25 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-amber-300 backdrop-blur-sm border border-white/10">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span>Plataforma Inteligente de Ventas con IA</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                  Crea Landings Persuasivas y Confirma Ventas en Piloto Automático
                </h2>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                  Genera una página completa en 30 segundos a partir de una foto, activa agentes de voz para confirmar tus pedidos contraentrega y gestiona todos tus mensajes en un CRM omnicanal.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => setIsWizardOpen(true)}
                  className="px-6 py-3.5 bg-brand-gradient hover:opacity-95 text-white font-bold text-xs md:text-sm rounded-xl shadow-glow-orange flex items-center justify-center gap-2.5 transition transform hover:scale-[1.02] active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>Crear Landing con IA</span>
                </button>

                <button
                  onClick={() => handleTestCall()}
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs md:text-sm rounded-xl backdrop-blur-md border border-white/20 flex items-center justify-center gap-2 transition"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-400" />
                  <span>Probar Llamada IA</span>
                </button>
              </div>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1: Total Orders */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Pedidos Registrados</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-brand-navy flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{orders.length}</span>
                <span className="text-[11px] font-bold text-emerald-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-0.5" /> +18.4%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Capturados desde tus landing pages</p>
            </div>

            {/* Stat 2: Voice Confirmed */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Confirmados por Voz IA</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600">{confirmedOrdersCount}</span>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                  {confirmationRate}% efectividad
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Verificación telefónica de datos COD</p>
            </div>

            {/* Stat 3: Total Revenue */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Facturación Bruta (COD)</span>
                <div className="w-8 h-8 rounded-lg bg-red-50 text-brand-red flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  ${totalRevenue.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">COP</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Monto en órdenes activas y despachadas</p>
            </div>

            {/* Stat 4: Active CRM Chats */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Llamadas Pendientes</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-600">{pendingCallsCount}</span>
                <span className="text-[11px] text-slate-500">en cola para marcar</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Disparo según horario permitido</p>
            </div>
          </div>

          {/* Operational Sections: Two Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Landing Pages & Orders */}
            <div className="lg:col-span-2 space-y-6">
              {/* Landings Showcase */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-navy" />
                    <h3 className="text-sm font-bold text-slate-900">Tus Landing Pages Activas</h3>
                  </div>
                  <Link
                    href="/landings"
                    className="text-xs font-semibold text-brand-navy hover:underline flex items-center gap-1"
                  >
                    <span>Ver todas ({landings.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {landings.slice(0, 3).map((landing) => (
                    <div
                      key={landing.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-white transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={landing.mainImage}
                          alt={landing.productName}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-brand-red transition">
                            {landing.productName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-emerald-600">
                              ${landing.promoPrice.toLocaleString()} {landing.currency}
                            </span>
                            <span>•</span>
                            <span>{landing.viewsCount} visitas</span>
                            <span>•</span>
                            <span className="font-bold text-slate-700">{landing.ordersCount} pedidos</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <Link
                          href={`/landings/editor/${landing.id}`}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Editor</span>
                        </Link>

                        <a
                          href={landing.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-brand-navyDark hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Pública</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders Table Snapshot */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-brand-navy" />
                    <h3 className="text-sm font-bold text-slate-900">Últimos Pedidos Capturados</h3>
                  </div>
                  <Link
                    href="/orders"
                    className="text-xs font-semibold text-brand-navy hover:underline flex items-center gap-1"
                  >
                    <span>Ir a gestión de pedidos</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-2.5">Pedido</th>
                        <th className="pb-2.5">Cliente</th>
                        <th className="pb-2.5">Ciudad</th>
                        <th className="pb-2.5">Total</th>
                        <th className="pb-2.5">Estado Llamada</th>
                        <th className="pb-2.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 4).map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 font-mono font-bold text-slate-800">{order.orderNumber}</td>
                          <td className="py-3">
                            <p className="font-semibold text-slate-900">{order.customerName}</p>
                            <p className="text-[10px] text-slate-400">{order.phone}</p>
                          </td>
                          <td className="py-3 text-slate-600">{order.city}</td>
                          <td className="py-3 font-bold text-slate-900">
                            ${order.totalAmount.toLocaleString()}
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                order.status === 'confirmed_by_voice'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : order.status === 'pending_call'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : order.status === 'needs_review'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {order.status === 'confirmed_by_voice' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              {order.status === 'pending_call' && <Clock className="w-3 h-3 text-amber-600" />}
                              {order.status === 'needs_review' && <AlertCircle className="w-3 h-3 text-blue-600" />}
                              {order.status === 'confirmed_by_voice'
                                ? 'Confirmado Voz'
                                : order.status === 'pending_call'
                                ? 'Pendiente Llamada'
                                : order.status === 'needs_review'
                                ? 'Revisión Humana'
                                : order.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleTestCall(order)}
                              className="px-2.5 py-1 bg-brand-navy hover:bg-slate-800 text-white rounded text-[11px] font-bold transition inline-flex items-center gap-1"
                            >
                              <PhoneCall className="w-3 h-3" />
                              <span>Llamar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Voice AI & CRM Live Feeds */}
            <div className="space-y-6">
              {/* Voice Agent Status Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">Agente de Voz Activo</h3>
                  </div>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Nombre del Agente:</span>
                    <span className="font-bold text-slate-900">Valentina IA (Bogotá)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Proveedor:</span>
                    <span className="font-semibold text-brand-navy">Simulador / Vapi / Retell</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Horario Permitido:</span>
                    <span className="font-semibold text-slate-700">08:30 - 19:30</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Llamadas Realizadas:</span>
                    <span className="font-bold text-emerald-600">{callTasks.length} llamadas</span>
                  </div>
                </div>

                <button
                  onClick={() => handleTestCall()}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Probar Llamada en Vivo</span>
                </button>
              </div>

              {/* Quick CRM Messaging Snapshot */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-brand-red" />
                    <h3 className="text-sm font-bold text-slate-900">Bandeja CRM Omnicanal</h3>
                  </div>
                  <span className="text-[10px] font-bold bg-brand-red text-white px-2 py-0.5 rounded-full">
                    WhatsApp API
                  </span>
                </div>

                <p className="text-xs text-slate-500">
                  Centraliza conversaciones de WhatsApp oficial, notas internas de tu equipo y consultas pre-despacho.
                </p>

                <Link
                  href="/crm"
                  className="block w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-center font-bold text-xs rounded-xl transition"
                >
                  Abrir Bandeja de Mensajes
                </Link>
              </div>
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

      <VoiceCallSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        task={activeSimTask}
        onCompleted={() => refreshData()}
      />
    </div>
  );
}
