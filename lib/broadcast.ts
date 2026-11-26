// Envíos masivos: what the panel and the server share (types, reading the pasted list, filling the template).
import { normalizePhone } from '@/lib/phone';

export type VarSource = { kind: 'name' } | { kind: 'col'; col: number } | { kind: 'text'; text: string };
export type RowStatus = 'pending' | 'sent' | 'failed';
export interface BroadcastRow {
  phone: string; // E.164 digits
  name: string;
  cols: string[];
  status: RowStatus;
  error?: string;
  sentAt?: string;
}
export interface Broadcast {
  id: string;
  name: string;
  template: {
    name: string;
    lang: string;
    category: string;
    body: string;
    vars: number;
    imageHeader: boolean;
  };
  vars: VarSource[];
  image?: string; // header photo for templates that carry one
  columns: string[]; // names of the extra columns (Columna 3, Columna 4… or the pasted header)
  rows: BroadcastRow[];
  createdAt: string;
  by?: string | null;
}

export const MAX_ROWS = 500;

export interface TemplateOption {
  name: string;
  lang: string;
  category: string;
  body: string;
  vars: number;
  imageHeader: boolean;
  buttons: string[];
  supported: boolean;
  why?: string; // why it can't be used here
}

// ---------- the list ----------

export const cleanCell = (v: unknown) =>
  String(v ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 200);
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

// Pasted text (Excel/Sheets columns or "celular, nombre, …" lines) → rows. The column with the phone is found on
// its own; a first line without a phone is taken as the header.
export function parseList(
  text: string,
  country = 'Colombia',
): {
  columns: string[];
  rows: BroadcastRow[];
  invalid: number;
  duplicates: number;
} {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_ROWS + 1);
  const split = (l: string) => (l.includes('\t') ? l.split('\t') : l.includes(';') ? l.split(';') : l.split(',')).map(cleanCell);
  const cells = lines.map(split);
  const isPhone = (v: string) => {
    const d = v.replace(/\D/g, '');
    return d.length >= 7 && d.length <= 15 && /^[\s+()\d-]+$/.test(v);
  };
  // The phone column: the one that most often looks like a phone.
  const width = Math.max(0, ...cells.map((c) => c.length));
  let phoneCol = 0;
  let best = -1;
  for (let i = 0; i < width; i++) {
    const n = cells.filter((c) => isPhone(c[i] || '')).length;
    if (n > best) ((best = n), (phoneCol = i));
  }
  const header = cells.length && !isPhone(cells[0][phoneCol] || '') ? cells.shift()! : null;
  // The name column: the first other column with letters.
  const nameCol = Array.from({ length: width }, (_, i) => i).find((i) => i !== phoneCol && cells.some((c) => /[a-záéíóúñ]/i.test(c[i] || '')));
  const extra = Array.from({ length: width }, (_, i) => i).filter((i) => i !== phoneCol && i !== nameCol);
  const columns = extra.map((i, k) => (header?.[i] ? header[i] : `Columna ${k + 3}`));
  const seen = new Set<string>();
  const rows: BroadcastRow[] = [];
  let invalid = 0;
  let duplicates = 0;
  for (const c of cells) {
    const phone = normalizePhone(c[phoneCol] || '', country);
    if (!isPhone(c[phoneCol] || '') || phone.length < 10) {
      invalid++;
      continue;
    }
    if (seen.has(phone)) {
      duplicates++;
      continue;
    }
    seen.add(phone);
    rows.push({
      phone,
      name: titleCase(nameCol !== undefined ? c[nameCol] || '' : ''),
      cols: extra.map((i) => c[i] || ''),
      status: 'pending',
    });
    if (rows.length >= MAX_ROWS) break;
  }
  return { columns, rows, invalid, duplicates };
}

const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] || '';

// The template's variables for one row. Template values can't have line breaks or be empty.
export function rowVars(b: Pick<Broadcast, 'vars'>, r: Pick<BroadcastRow, 'name' | 'cols'>): string[] {
  return b.vars.map((v) => {
    const raw = v.kind === 'name' ? firstName(r.name) || 'cliente' : v.kind === 'col' ? r.cols[v.col] || '' : v.text;
    return cleanCell(raw) || '—';
  });
}
export const fillBody = (body: string, vars: string[]) => body.replace(/\{\{(\d+)\}\}/g, (_, i) => vars[Number(i) - 1] ?? '');

// ---------- a CSV file (Shopify export, Excel "guardar como CSV") ----------

// RFC 4180-style CSV: quoted fields may hold commas, quotes ("") and line breaks.
export function parseCsv(text: string): string[][] {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const PLACEHOLDER_CITY = /^(toca para seleccionar|selecciona.*|ciudad|municipio|-+|\.+|.)$/i;
const niceCity = (c: string) => {
  const v = cleanCell(c).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (!v || PLACEHOLDER_CITY.test(v)) return '';
  return v === v.toUpperCase() || v === v.toLowerCase() ? titleCase(v) : v;
};
const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export interface ImportResult {
  columns: string[];
  rows: BroadcastRow[];
  kind: 'shopify' | 'csv';
  removed: { tests: number; duplicates: number; done: number; noPhone: number };
}

// A Shopify export (draft orders, orders or abandoned checkouts): one contact per order with its own product and
// units, total, city and address. Test orders ("prueba") and finished drafts are left out; a customer that appears
// twice keeps the newest. Any other CSV is read like a pasted list.
export function importCsv(text: string, country = 'Colombia'): ImportResult {
  const table = parseCsv(text);
  const head = (table[0] || []).map((h) => h.trim().toLowerCase());
  const has = (...names: string[]) => names.some((n) => head.includes(n.toLowerCase()));
  const iName = head.indexOf('name');
  if (iName < 0 || !has('Shipping Phone', 'Phone', 'Billing Phone') || !has('Lineitem name', 'Item Name')) {
    const asText = table.map((r) => r.map(cleanCell).join(';')).join('\n');
    const p = parseList(asText, country);
    return { columns: p.columns, rows: p.rows, kind: 'csv', removed: { tests: 0, duplicates: p.duplicates, done: 0, noPhone: p.invalid } };
  }
  const get = (r: string[], ...names: string[]) => {
    for (const n of names) {
      const i = head.indexOf(n.toLowerCase());
      if (i >= 0 && r[i]?.trim()) return r[i].trim();
    }
    return '';
  };
  // Lines of the same order share its "Name" (#D12, #1001…); the order's own fields are on its first line.
  const orders = new Map<string, { first: string[]; items: { title: string; qty: number }[] }>();
  for (const r of table.slice(1)) {
    const key = r[iName] || '';
    if (!key) continue;
    const o = orders.get(key) || { first: r, items: [] };
    const title = get(r, 'Lineitem name', 'Item Name');
    if (title) o.items.push({ title, qty: Number(get(r, 'Lineitem quantity', 'Item Quantity')) || 1 });
    orders.set(key, o);
  }
  const when = (v: string) => Date.parse(v.replace(/ ([-+])(\d\d)(\d\d)$/, '$1$2:$3').replace(' ', 'T')) || 0;
  const list = Array.from(orders.values())
    .map((o) => ({ ...o, at: when(get(o.first, 'Created at', 'Created At')) }))
    .sort((a, b) => b.at - a.at);
  const removed = { tests: 0, duplicates: 0, done: 0, noPhone: 0 };
  const seen = new Set<string>();
  const rows: BroadcastRow[] = [];
  // Phones used in test orders, found first so a test that comes later in the file still counts.
  const testPhones = new Set<string>();
  for (const { first } of list)
    if (/\bprueba\b|\btest\b/i.test(get(first, 'Shipping Name', 'Billing Name'))) testPhones.add(normalizePhone(get(first, 'Shipping Phone', 'Phone', 'Billing Phone'), country));
  for (const { first, items } of list) {
    const name = titleCase(
      cleanCell(get(first, 'Shipping Name', 'Billing Name'))
        .replace(/(^|\s)['-]+(?=\s|$)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
    const rawPhone = normalizePhone(get(first, 'Shipping Phone', 'Phone', 'Billing Phone'), country);
    // Test orders, and anyone else with the phone used for tests (the store's own number).
    if (/\bprueba\b|\btest\b/i.test(name) || testPhones.has(rawPhone)) {
      removed.tests++;
      testPhones.add(rawPhone);
      continue;
    }
    if (/completed|completado/i.test(get(first, 'Status')) || get(first, 'Completed At')) {
      removed.done++;
      continue;
    }
    const phone = rawPhone;
    if (phone.length < 10) {
      removed.noPhone++;
      continue;
    }
    if (seen.has(phone)) {
      removed.duplicates++;
      continue;
    }
    seen.add(phone);
    // "Horse Boost" × 3 → "Horse Boost (3 unidades)"; "hoorse boost 2 - 3 unidades" keeps its own units.
    const product = items
      .map((i) => {
        const own = /(\d+)\s*unidad/i.exec(i.title);
        const units = own ? Number(own[1]) : i.qty;
        const base = cleanCell(i.title.replace(/\s*-\s*\d+\s*unidad(es)?\s*$/i, ''));
        return `${titleCase(base)} (${units} ${units === 1 ? 'unidad' : 'unidades'})`;
      })
      .join(' + ');
    const total = Number(get(first, 'Total').replace(/[^\d.]/g, '')) || 0;
    const city = niceCity(get(first, 'Shipping City', 'Billing City'));
    const dept = cleanCell(get(first, 'Shipping Province Name', 'Billing Province Name'));
    const addr = cleanCell(get(first, 'Shipping Address1', 'Shipping Street', 'Billing Address1'));
    rows.push({ phone, name, cols: [product, total ? money(total) : '', city || dept || 'tu ciudad', /^[-.\sC]*$/.test(addr) ? '' : addr], status: 'pending' });
    if (rows.length >= MAX_ROWS) break;
  }
  return { columns: ['Producto', 'Total', 'Ciudad', 'Dirección'], rows, kind: 'shopify', removed };
}

// What goes in each {{n}}, guessed from the words before it in the template and the list's column names:
// {{1}} the name; "pedido de {{n}}" the product; "por {{n}}" / "$" the total; "en / a {{n}}" the city.
export function guessVars(body: string, vars: number, columns: string[]): VarSource[] {
  const find = (re: RegExp) => columns.findIndex((c) => re.test(c));
  const product = find(/produc|art[ií]culo|item/i);
  const total = find(/total|valor|precio|monto/i);
  const city = find(/ciudad|municipio|city/i);
  const address = find(/direcci|address/i);
  const pick = (i: number): VarSource | null => (i >= 0 ? { kind: 'col', col: i } : null);
  return Array.from({ length: vars }, (_, k) => {
    const n = k + 1;
    const before = (body.split(`{{${n}}}`)[0] || '').slice(-40).toLowerCase();
    if (n === 1 && /(hola|hi|buen[oa]s?)\W*$/i.test(before)) return { kind: 'name' } as VarSource;
    return (
      (/direcci[oó]n\W*$/.test(before) && pick(address)) ||
      (/\bde\s*$/.test(before) && pick(product)) ||
      (/(por|total|valor|precio|\$)\s*$/.test(before) && pick(total)) ||
      (/\b(en|a|hacia|para)\s*$/.test(before) && pick(city)) ||
      (n === 1 ? ({ kind: 'name' } as VarSource) : null) ||
      (k - 1 < columns.length ? ({ kind: 'col', col: Math.max(0, k - 1) } as VarSource) : ({ kind: 'text', text: '' } as VarSource))
    );
  });
}
