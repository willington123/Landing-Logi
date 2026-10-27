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
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Confirmado por Voz IA</span>
          </span>
        );
      case 'pending_call':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Pendiente de Llamada</span>
          </span>
        );
      case 'calling':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Phone className="w-3.5 h-3.5 text-blue-600" />
            <span>Marcando Ahora...</span>
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span>Revisión Humana</span>
          </span>
        );
      case 'retry_scheduled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
            <span>Reintento Programado</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Cancelado</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onOpenWizard={() => setIsWizardOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenWizard={() => setIsWizardOpen(true)} title="Gestión de Pedidos & Despachos" />

        <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Top Title & Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Pedidos de Pago Contraentrega (COD)
              </h2>
              <p className="text-xs text-slate-500">
                Audita confirmaciones automáticas de llamadas, direcciones y despachos logísticos.
              </p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por #orden, cliente, ciudad..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-700 focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:ring-2 focus:ring-brand-red"
              >
                <option value="all">Todos los Estados</option>
                <option value="pending_call">Pendiente de Llamada</option>
                <option value="confirmed_by_voice">Confirmados por Voz IA</option>
                <option value="needs_review">Requiere Revisión Humana</option>
                <option value="retry_scheduled">Reintento Programado</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Orden</th>
                    <th className="py-3 px-4">Cliente & Teléfono</th>
                    <th className="py-3 px-4">Destino (Ciudad / Dpto)</th>
                    <th className="py-3 px-4">Combo & Unidades</th>
                    <th className="py-3 px-4">Total COD</th>
                    <th className="py-3 px-4">Estado Confirmación</th>
                    <th className="py-3 px-4 text-right">Llamada IA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {order.orderNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{order.customerName}</p>
                        <p className="text-[11px] text-slate-500">{order.phone}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">{order.city}</p>
                        <p className="text-[10px] text-slate-400">{order.department}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-800 line-clamp-1">{order.comboName}</p>
                        <p className="text-[10px] text-slate-400">{order.productName}</p>
                      </td>
                      <td className="py-3.5 px-4 font-black text-slate-900">
                        ${order.totalAmount.toLocaleString()} COP
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLaunchCall(order);
                          }}
                          className="px-3 py-1.5 bg-brand-navy hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Llamar IA</span>
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="font-mono text-sm font-bold text-brand-navy">
                  Detalle del Pedido #{selectedOrder.orderNumber}
                </span>
                <p className="text-xs text-slate-400">Registrado desde landing page</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Cliente</span>
                  <p className="font-bold text-slate-900">{selectedOrder.customerName}</p>
                  <p className="text-slate-500">{selectedOrder.phone}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Total a Cobrar</span>
                  <p className="font-black text-brand-red text-sm">
                    ${selectedOrder.totalAmount.toLocaleString()} COP
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold">Pago Contraentrega</p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Dirección Exacta</span>
                <p className="font-semibold text-slate-800">{selectedOrder.address}</p>
                <p className="text-slate-500">{selectedOrder.city}, {selectedOrder.department}</p>
                {selectedOrder.notes && (
                  <p className="mt-1 text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 text-[11px]">
                    Nota del cliente: {selectedOrder.notes}
                  </p>
                )}
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Campaña de Atribución</span>
                <p className="font-mono text-[11px] text-slate-600">
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
                className="flex-1 py-2.5 bg-brand-gradient hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Activar Llamada de Confirmación IA</span>
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
