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
    const raw = v.kind === 'name' ? firstName(r.name) || 'hola' : v.kind === 'col' ? r.cols[v.col] || '' : v.text;
    return cleanCell(raw) || '—';
  });
}
export const fillBody = (body: string, vars: string[]) => body.replace(/\{\{(\d+)\}\}/g, (_, i) => vars[Number(i) - 1] ?? '');
