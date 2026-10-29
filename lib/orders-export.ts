// Turns orders into an Excel sheet (Pedidos page → "Descargar Excel").
import type { OrderItem } from '@/lib/types';
import { downloadXlsx, type Cell, type SheetColumn } from '@/lib/xlsx';

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_call: 'Por llamar',
  calling: 'Llamando',
  confirmed_by_voice: 'Confirmado',
  needs_review: 'Por revisar',
  unanswered: 'No contesta',
  retry_scheduled: 'Reintento',
  cancelled: 'Cancelado',
  shipped: 'En camino',
  delivered: 'Entregado',
};

const PAYMENT_LABEL: Record<string, string> = {
  cash_on_delivery: 'Contraentrega',
  card_online: 'Tarjeta',
  bank_transfer: 'Transferencia',
  whatsapp_order: 'WhatsApp',
};

const dateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const COLUMNS: (SheetColumn & { value: (o: OrderItem & { whatsapp?: { ok?: boolean } }) => Cell })[] = [
  { header: 'Pedido', width: 11, value: (o) => o.orderNumber },
  { header: 'Fecha', width: 17, value: (o) => dateTime(o.createdAt) },
  { header: 'Estado', width: 13, value: (o) => ORDER_STATUS_LABEL[o.status] || o.status },
  { header: 'Cliente', width: 26, value: (o) => o.customerName },
  { header: 'Celular', width: 16, value: (o) => o.phone },
  { header: 'Departamento', width: 16, value: (o) => o.department },
  { header: 'Ciudad', width: 16, value: (o) => o.city },
  { header: 'Dirección', width: 40, value: (o) => o.address },
  { header: 'Notas', width: 30, value: (o) => o.notes },
  { header: 'Producto', width: 28, value: (o) => o.productName },
  { header: 'Oferta', width: 18, value: (o) => o.comboName },
  { header: 'Unidades', width: 10, value: (o) => o.units },
  { header: 'Total', width: 12, money: true, value: (o) => o.totalAmount },
  { header: 'Pago', width: 14, value: (o) => PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod },
  { header: 'Confirmado el', width: 17, value: (o) => dateTime(o.confirmedAt) },
  { header: 'Transportadora', width: 16, value: (o) => o.carrier || '' },
  { header: 'Guía', width: 18, value: (o) => o.trackingNumber || '' },
  { header: 'WhatsApp', width: 11, value: (o) => (o.whatsapp ? (o.whatsapp.ok ? 'Enviado' : 'Falló') : '') },
  { header: 'Origen', width: 16, value: (o) => (o.source === 'whatsapp_bot' ? 'Asistente WhatsApp' : 'Landing') },
  { header: 'UTM source', width: 14, value: (o) => o.utmSource },
  { header: 'UTM campaign', width: 18, value: (o) => o.utmCampaign },
];

export function orderRows(orders: OrderItem[]): Cell[][] {
  return orders.map((o) => COLUMNS.map((c) => c.value(o)));
}

export function downloadOrdersExcel(orders: OrderItem[]) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  downloadXlsx(`pedidos-${stamp}.xlsx`, 'Pedidos', COLUMNS, orderRows(orders));
}
