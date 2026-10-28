'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LandingWizardModal from '@/components/landings/LandingWizardModal';
import { CallButton } from '@/components/voice/CallButton';
import { logiStore } from '@/lib/store';
import { CLOUD_SYNC_EVENT, deleteOrders, pullFromCloud } from '@/lib/cloud';
import { OrderItem, OrderStatus } from '@/lib/types';
import {
  ShoppingBag,
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
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';
import { downloadOrdersExcel } from '@/lib/orders-export';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  // Deleting: checked rows, and the ids waiting for confirmation.
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refreshData = () => {
    const fresh = logiStore.getOrders();
    setOrders(fresh);
    // Keep the open detail in step with the latest data.
    setSelectedOrder((cur) => (cur ? fresh.find((o) => o.id === cur.id) || null : cur));
  };

  useEffect(() => {
    refreshData();
    // Re-read when fresh data arrives from Supabase.
    window.addEventListener(CLOUD_SYNC_EVENT, refreshData);
    return () => window.removeEventListener(CLOUD_SYNC_EVENT, refreshData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While an AI call is running, refresh from the server so its result shows up by itself.
  const anyCalling = orders.some((o) => o.status === 'calling');
  useEffect(() => {
    if (!anyCalling) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') pullFromCloud();
    }, 10000);
    return () => clearInterval(t);
  }, [anyCalling]);

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const askDelete = (ids: string[]) => {
    setDeleteError(null);
    setConfirmIds(ids);
  };

  const handleConfirmDelete = async () => {
    if (!confirmIds) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOrders(confirmIds);
      const gone = new Set(confirmIds);
      setChecked((prev) => new Set(Array.from(prev).filter((id) => !gone.has(id))));
      if (selectedOrder && gone.has(selectedOrder.id)) setSelectedOrder(null);
      setConfirmIds(null);
      refreshData();
    } catch (e: any) {
      setDeleteError(e?.message || 'No se pudieron eliminar los pedidos.');
    } finally {
      setDeleting(false);
    }
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
  const visibleChecked = filteredOrders.filter((o) => checked.has(o.id));
  const allVisibleChecked = filteredOrders.length > 0 && visibleChecked.length === filteredOrders.length;
  const toggleAllVisible = () =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) filteredOrders.forEach((o) => next.delete(o.id));
      else filteredOrders.forEach((o) => next.add(o.id));
      return next;
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
      case 'unanswered':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/15">
            <Phone className="w-3.5 h-3.5 text-orange-600" />
            <span>No contesta</span>
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
                <option value="calling">Llamando</option>
                <option value="unanswered">No contesta</option>
                <option value="cancelled">Cancelados</option>
              </select>
              <button
                type="button"
                onClick={() => downloadOrdersExcel(filteredOrders)}
                disabled={filteredOrders.length === 0}
                title="Descarga los pedidos que ves en la tabla (con los filtros aplicados)"
                className="h-9 px-3 text-sm font-medium whitespace-nowrap shrink-0 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Descargar Excel
              </button>
            </div>
          </div>

          {visibleChecked.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <span className="text-sm text-slate-700">
                {visibleChecked.length} {visibleChecked.length === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChecked(new Set())}
                  className="h-8 px-3 text-[13px] font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition"
                >
                  Quitar selección
                </button>
                <button
                  type="button"
                  onClick={() => askDelete(visibleChecked.map((o) => o.id))}
                  className="h-8 px-3 text-[13px] font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs text-slate-500">
                    <th className="py-3 pl-5 pr-1 w-8">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos los pedidos visibles"
                        checked={allVisibleChecked}
                        onChange={toggleAllVisible}
                        className="w-4 h-4 rounded border-slate-300 align-middle cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 font-medium">Pedido</th>
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
                      <td colSpan={8} className="py-12 text-center text-sm text-slate-500">No hay pedidos con estos filtros.</td>
                    </tr>
                  )}
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`transition cursor-pointer ${checked.has(order.id) ? 'bg-slate-50' : 'hover:bg-slate-50/70'}`}
                    >
                      <td className="py-3.5 pl-5 pr-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar pedido ${order.orderNumber}`}
                          checked={checked.has(order.id)}
                          onChange={() => toggleChecked(order.id)}
                          className="w-4 h-4 rounded border-slate-300 align-middle cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[13px] text-slate-500 whitespace-nowrap">{order.orderNumber}</td>
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
                        <CallButton order={order} onCalled={() => pullFromCloud()} />
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

              {(selectedOrder.callNotes || selectedOrder.previousAddress) && (
                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1">
                  <span className="text-indigo-700 text-xs font-semibold">Llamada IA</span>
                  {selectedOrder.callNotes && <p className="text-slate-700">{selectedOrder.callNotes}</p>}
                  {selectedOrder.previousAddress && (
                    <p className="text-slate-500">
                      El cliente corrigió la dirección. Antes: <span className="line-through">{selectedOrder.previousAddress}</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <span className="text-slate-500 text-xs font-medium">Campaña de Atribución</span>
                <p className="font-mono text-xs text-slate-600">
                  UTM: {selectedOrder.utmSource || 'directo'} / {selectedOrder.utmCampaign || 'general'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <CallButton order={selectedOrder} variant="wide" onCalled={() => pullFromCloud()} />
              <button
                onClick={() => askDelete([selectedOrder.id])}
                className="h-10 px-4 border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmIds && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {confirmIds.length === 1 ? '¿Eliminar este pedido?' : `¿Eliminar ${confirmIds.length} pedidos?`}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Se borrarán para siempre del panel y de la base de datos. No se puede deshacer. Si los necesitas, descárgalos antes en Excel.
              </p>
            </div>
            {deleteError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmIds(null)}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <LandingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onGenerated={() => refreshData()}
      />
    </div>
  );
}
