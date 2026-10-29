// CRM (Mensajes): quick replies and tags. Shared by the panel and the server.

export interface QuickReply {
  id: string;
  shortcut: string; // typed after "/" in the reply box, e.g. "envio"
  title: string;
  body: string; // may contain {nombre} {pedido} {producto} {total} {ciudad} {direccion}
}

export interface CrmTag {
  id: string;
  name: string;
  color: TagColor;
}

export const TAG_COLORS = {
  blue: { label: 'Azul', chip: 'bg-blue-50 text-blue-700 ring-blue-600/20', dot: 'bg-blue-500' },
  green: { label: 'Verde', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  amber: { label: 'Amarillo', chip: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
  violet: { label: 'Morado', chip: 'bg-violet-50 text-violet-700 ring-violet-600/20', dot: 'bg-violet-500' },
  red: { label: 'Rojo', chip: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500' },
  pink: { label: 'Rosado', chip: 'bg-pink-50 text-pink-700 ring-pink-600/20', dot: 'bg-pink-500' },
  sky: { label: 'Celeste', chip: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500' },
  slate: { label: 'Gris', chip: 'bg-slate-100 text-slate-700 ring-slate-500/20', dot: 'bg-slate-500' },
} as const;
export type TagColor = keyof typeof TAG_COLORS;
export const isTagColor = (c: unknown): c is TagColor => typeof c === 'string' && c in TAG_COLORS;

export const DEFAULT_TAGS: CrmTag[] = [
  { id: 'nuevo', name: 'Nuevo', color: 'blue' },
  { id: 'confirmado', name: 'Confirmado', color: 'green' },
  { id: 'dudas', name: 'Dudas', color: 'amber' },
  { id: 'cambio-direccion', name: 'Cambio de dirección', color: 'violet' },
  { id: 'reclamo', name: 'Reclamo', color: 'red' },
  { id: 'no-responde', name: 'No responde', color: 'slate' },
  { id: 'vip', name: 'VIP', color: 'pink' },
];

export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: 'hola', shortcut: 'hola', title: 'Saludo', body: '¡Hola {nombre}! 👋 Gracias por escribirnos. ¿En qué te puedo ayudar?' },
  {
    id: 'confirmar',
    shortcut: 'confirmar',
    title: 'Confirmar pedido',
    body: 'Hola {nombre}, te escribo para confirmar tu pedido {pedido}: {producto} por {total}, pago contraentrega en {ciudad}. ¿Me confirmas que todo está bien? ✅',
  },
  {
    id: 'direccion',
    shortcut: 'direccion',
    title: 'Pedir dirección',
    body: '¿Me confirmas por favor tu dirección completa (calle o carrera, número y barrio) y alguna referencia para el mensajero? 📍\nDirección que tenemos: {direccion}, {ciudad}.',
  },
  {
    id: 'envio',
    shortcut: 'envio',
    title: 'Pedido despachado',
    body: '¡Buenas noticias, {nombre}! Tu pedido {pedido} ya fue despachado 🚚 Llega en 2 a 5 días hábiles. Ten listo el pago de {total} para cuando lo recibas.',
  },
  {
    id: 'pago',
    shortcut: 'pago',
    title: 'Pago contraentrega',
    body: 'El pago es contraentrega 💵: pagas en efectivo cuando recibes el producto en tu casa. No tienes que pagar nada por adelantado.',
  },
  {
    id: 'garantia',
    shortcut: 'garantia',
    title: 'Garantía',
    body: 'Tu producto tiene garantía ✅ Si llega con algún problema, escríbenos por aquí con una foto y lo solucionamos.',
  },
  { id: 'gracias', shortcut: 'gracias', title: 'Gracias', body: '¡Gracias por tu compra, {nombre}! Cualquier duda, aquí estamos 🙌' },
];

export const QUICK_REPLY_VARS = ['nombre', 'pedido', 'producto', 'total', 'ciudad', 'direccion'] as const;

// Fills {nombre}, {pedido}… with the conversation's data. Unknown values become an empty string.
export function fillQuickReply(body: string, vars: Partial<Record<(typeof QUICK_REPLY_VARS)[number], string>>) {
  return body
    .replace(/\{(nombre|pedido|producto|total|ciudad|direccion)\}/g, (_, k: (typeof QUICK_REPLY_VARS)[number]) => vars[k] || '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([,.!?])/g, '$1');
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

export const shortcutFrom = (s: string) => slug(s).replace(/-/g, '').slice(0, 20);

// Validates what the panel sends. Returns the clean list or an error message.
export function cleanQuickReplies(input: unknown): QuickReply[] | string {
  if (!Array.isArray(input)) return 'Lista inválida.';
  if (input.length > 100) return 'Máximo 100 respuestas rápidas.';
  const out: QuickReply[] = [];
  const seen = new Set<string>();
  for (const r of input) {
    const title = String(r?.title ?? '').trim().slice(0, 60);
    const body = String(r?.body ?? '').trim().slice(0, 1000);
    const shortcut = shortcutFrom(String(r?.shortcut ?? '') || title);
    if (!title || !body) return 'Cada respuesta necesita nombre y texto.';
    if (!shortcut) return `El atajo de "${title}" no es válido.`;
    if (seen.has(shortcut)) return `El atajo /${shortcut} está repetido.`;
    seen.add(shortcut);
    const id = /^[\w-]{1,40}$/.test(String(r?.id ?? '')) ? String(r.id) : `qr-${shortcut}-${Math.random().toString(36).slice(2, 6)}`;
    out.push({ id, shortcut, title, body });
  }
  return out;
}

export function cleanTags(input: unknown): CrmTag[] | string {
  if (!Array.isArray(input)) return 'Lista inválida.';
  if (input.length > 30) return 'Máximo 30 etiquetas.';
  const out: CrmTag[] = [];
  const names = new Set<string>();
  for (const t of input) {
    const name = String(t?.name ?? '').trim().slice(0, 30);
    if (!name) return 'Cada etiqueta necesita un nombre.';
    if (names.has(name.toLowerCase())) return `La etiqueta "${name}" está repetida.`;
    names.add(name.toLowerCase());
    const id = /^[\w-]{1,40}$/.test(String(t?.id ?? '')) ? String(t.id) : `${slug(name) || 'tag'}-${Math.random().toString(36).slice(2, 6)}`;
    out.push({ id, name, color: isTagColor(t?.color) ? t.color : 'slate' });
  }
  return out;
}
