// Orders → Dropi's bulk upload Excel ("Formato de órdenes Masivas"), one order per row.
import { DROPI_BULK_HEADERS, DROPI_COD_CITIES } from '@/lib/dropi-bulk-places';
import { downloadXlsx, type Cell } from '@/lib/xlsx';
import type { OrderItem } from '@/lib/types';

export interface BulkLink {
  productId: number;
  variationId: number | null;
  name?: string;
}

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(d\.?\s?c\.?|departamento( de(l)?)?)\b/g, ' ')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const DEPTS = Object.keys(DROPI_COD_CITIES);

// Department as Dropi writes it in the template ("Bogotá D.C." → CUNDINAMARCA, "Valle del Cauca" → VALLE).
export function bulkDepartment(department: string, city = ''): string | null {
  const d = norm(department);
  if (/^bogota/.test(d) || (!d && /^bogota/.test(norm(city)))) return 'CUNDINAMARCA';
  if (/^valle/.test(d)) return 'VALLE';
  if (/guajira/.test(d)) return 'LA GUAJIRA';
  if (/norte de santander/.test(d)) return 'NORTE DE SANTANDER';
  return DEPTS.find((x) => norm(x) === d) || DEPTS.find((x) => d && (norm(x).startsWith(d) || d.startsWith(norm(x)))) || null;
}

// City as the template lists it in that department; null when Dropi has no cash on delivery there (or it's spelled differently).
export function bulkCity(city: string, dept: string | null): string | null {
  const c = norm(city).replace(/^bogota.*/, 'bogota');
  if (!dept || !c) return null;
  const list = DROPI_COD_CITIES[dept] || [];
  return list.find((x) => norm(x) === c) || list.find((x) => norm(x).split(' - ')[0] === c) || null;
}

export interface BulkRow {
  order: OrderItem;
  cells: Cell[];
  problems: string[]; // why Dropi may reject this row
}

const phoneOf = (p: string) => String(p || '').replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, '');

export function bulkRows(orders: OrderItem[], links: Record<string, BulkLink | null | undefined>): BulkRow[] {
  return orders.map((o) => {
    const problems: string[] = [];
    const link = o.landingPageId ? links[o.landingPageId] : null;
    if (!link) problems.push(`"${o.productName}" no tiene ID de producto de Dropi`);
    const dept = bulkDepartment(o.department, o.city);
    const city = bulkCity(o.city, dept);
    if (!dept) problems.push(`departamento "${o.department || '—'}" no está en la lista de Dropi`);
    else if (!city) problems.push(`"${o.city}" no está en las ciudades con recaudo de Dropi`);
    const phone = phoneOf(o.phone);
    if (phone.length < 10) problems.push('teléfono incompleto');
    if (!o.address) problems.push('falta la dirección');
    const [first, ...rest] = (o.customerName || '').trim().split(/\s+/);
    if (!rest.length) problems.push('el cliente no dio apellido');
    const cod = o.paymentMethod === 'cash_on_delivery' || !o.paymentMethod;
    const note = [o.notes, `Pedido ${o.orderNumber}`, o.comboName ? `Oferta: ${o.comboName}` : ''].filter(Boolean).join(' · ');
    const cells: Cell[] = [
      first || '',
      rest.join(' '),
      o.address,
      dept || (o.department || '').toUpperCase(),
      city || (o.city || '').toUpperCase(),
      phone,
      link?.productId ?? '',
      Math.max(1, Number(o.units) || 1),
      Math.round(Number(o.totalAmount) || 0),
      cod ? 'SI' : 'NO',
      note,
      o.email || '',
      link?.variationId ?? '',
      '',
      '',
      '',
      '',
      '',
    ];
    return { order: o, cells, problems };
  });
}

const WIDTHS = [16, 18, 40, 18, 18, 14, 14, 10, 14, 12, 40, 24, 14, 12, 14, 12, 14, 12];

export function downloadDropiBulk(rows: BulkRow[]) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  downloadXlsx(
    `dropi-pedidos-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.xlsx`,
    'Hoja1',
    DROPI_BULK_HEADERS.map((header, i) => ({ header, width: WIDTHS[i] })),
    rows.map((r) => r.cells),
  );
}
