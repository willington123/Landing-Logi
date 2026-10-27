'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import { VoiceCallSimulatorModal } from '@/components/voice/VoiceCallSimulatorModal';
import { logiStore } from '@/lib/store';
import { OrderItem, OrderStatus, VoiceCallTask } from '@/lib/types';
import {
  ShoppingBag,
  PhoneCall,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RotateCcw,
  Truck,
  MapPin,
  FileText,
  DollarSign,
  ChevronDown,
  Sparkles,
  Phone,
} from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [callTasks, setCallTasks] = useState<VoiceCallTask[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [activeCallTask, setActiveCallTask] = useState<VoiceCallTask | null>(null);

  const refreshData = () => {
    setOrders(logiStore.getOrders());
    setCallTasks(logiStore.getCallTasks());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleLaunchCall = (order: OrderItem) => {
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
    setActiveCallTask(task);
    setIsSimulatorOpen(true);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch =
      searchQuery === '' ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.phone.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'confirmed_by_voice':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Confirmado</span>
          </span>
        );
      case 'pending_call':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Por llamar</span>
          </span>
        );
      case 'calling':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Phone className="w-3.5 h-3.5 text-blue-600" />
            <span>Llamando…</span>
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/15">
            <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span>Revisar</span>
          </span>
        );
      case 'retry_scheduled':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/15">
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
            <span>Reintento</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Cancelado</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-slate-100 text-slate-700">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Pedidos" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 max-w-[1280px] mx-auto w-full">
          {/* Intro + filters */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Pedidos contraentrega</h2>
              <p className="text-sm text-slate-500 mt-0.5">Revisa confirmaciones, direcciones y estado de cada pedido.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="relative">
                <span className="sr-only">Buscar pedidos</span>
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  placeholder="Buscar por pedido, cliente o ciudad"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-72 h-9 text-sm bg-white border border-slate-200 rounded-lg pl-9 pr-3 text-slate-700 outline-none focus:border-brand-navy/40 focus:ring-4 focus:ring-brand-navy/10 transition"
                />
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 text-sm bg-white border border-slate-200 rounded-lg px-3 text-slate-700 outline-none focus:border-brand-navy/40 focus:ring-4 focus:ring-brand-navy/10"
              >
                <option value="all">Todos los estados</option>
                <option value="pending_call">Por llamar</option>
                <option value="confirmed_by_voice">Confirmados</option>
                <option value="needs_review">Por revisar</option>
                <option value="retry_scheduled">Reintento</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs text-slate-500">
                    <th className="py-3 px-5 font-medium">Pedido</th>
                    <th className="py-3 px-3 font-medium">Cliente</th>
                    <th className="py-3 px-3 font-medium hidden md:table-cell">Destino</th>
                    <th className="py-3 px-3 font-medium hidden lg:table-cell">Producto</th>
                    <th className="py-3 px-3 font-medium text-right">Total</th>
                    <th className="py-3 px-3 font-medium">Estado</th>
                    <th className="py-3 px-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-slate-500">No hay pedidos con estos filtros.</td>
                    </tr>
                  )}
                  {filteredOrders.map((order) => (
                    <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-slate-50/70 transition cursor-pointer">
                      <td className="py-3.5 px-5 font-mono text-[13px] text-slate-500 whitespace-nowrap">{order.orderNumber}</td>
                      <td className="py-3.5 px-3">
                        <p className="font-medium text-slate-900 whitespace-nowrap">{order.customerName}</p>
                        <p className="text-xs text-slate-500">{order.phone}</p>
                      </td>
                      <td className="py-3.5 px-3 hidden md:table-cell">
                        <p className="text-slate-800">{order.city}</p>
                        <p className="text-xs text-slate-400">{order.department}</p>
                      </td>
                      <td className="py-3.5 px-3 hidden lg:table-cell max-w-[260px]">
                        <p className="text-slate-800 truncate">{order.comboName}</p>
                        <p className="text-xs text-slate-400 truncate">{order.productName}</p>
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        ${order.totalAmount.toLocaleString('es-CO')}
                      </td>
                      <td className="py-3.5 px-3">{getStatusBadge(order.status)}</td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLaunchCall(order);
                          }}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 text-[13px] font-medium inline-flex items-center gap-1.5 transition whitespace-nowrap"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          Llamar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 ring-1 ring-inset ring-slate-600/15">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-base font-semibold text-slate-900">
                  Pedido {selectedOrder.orderNumber}
                </span>
                <p className="text-xs text-slate-400">Registrado desde landing page</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-500 text-xs font-medium">Cliente</span>
                  <p className="font-bold text-slate-900">{selectedOrder.customerName}</p>
                  <p className="text-slate-500">{selectedOrder.phone}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs font-medium">Total a Cobrar</span>
                  <p className="font-semibold text-slate-900 text-sm">
                    ${selectedOrder.totalAmount.toLocaleString()} COP
                  </p>
                  <p className="text-[11px] text-emerald-600 font-semibold">Pago Contraentrega</p>
                </div>
              </div>

              <div>
                <span className="text-slate-500 text-xs font-medium">Dirección Exacta</span>
                <p className="font-semibold text-slate-800">{selectedOrder.address}</p>
                <p className="text-slate-500">{selectedOrder.city}, {selectedOrder.department}</p>
                {selectedOrder.notes && (
                  <p className="mt-1 text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 text-xs">
                    Nota del cliente: {selectedOrder.notes}
                  </p>
                )}
              </div>

              <div>
                <span className="text-slate-500 text-xs font-medium">Campaña de Atribución</span>
                <p className="font-mono text-xs text-slate-600">
                  UTM: {selectedOrder.utmSource || 'directo'} / {selectedOrder.utmCampaign || 'general'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const ord = selectedOrder;
                  setSelectedOrder(null);
                  handleLaunchCall(ord);
                }}
                className="flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Llamar para confirmar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Simulator Modal */}
      <VoiceCallSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        task={activeCallTask}
        onCompleted={() => refreshData()}
      />

      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onGenerated={() => refreshData()}
      />
    </div>
  );
}
