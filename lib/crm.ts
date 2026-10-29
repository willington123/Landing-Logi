// CRM (Mensajes): quick replies and tags. Shared by the panel and the server.

export interface QuickReply {
  id: string;
  shortcut: string; // typed after "/" in the reply box, e.g. "envio"
  title: string;
  body: string; // may contain {nombre} {pedido} {producto} {total} {ciudad} {direccion} {transportadora} {guia}
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
  {
    id: 'guia',
    shortcut: 'guia',
    title: 'Número de guía',
    body: 'Hola {nombre} 🚚 Tu pedido {pedido} va con {transportadora}. Tu número de guía es {guia}. Ten listo el pago de {total} para cuando lo recibas.',
  },
  { id: 'gracias', shortcut: 'gracias', title: 'Gracias', body: '¡Gracias por tu compra, {nombre}! Cualquier duda, aquí estamos 🙌' },
];

export const QUICK_REPLY_VARS = ['nombre', 'pedido', 'producto', 'total', 'ciudad', 'direccion', 'transportadora', 'guia'] as const;

// Fills {nombre}, {pedido}… with the conversation's data. Unknown values become an empty string.
export function fillQuickReply(body: string, vars: Partial<Record<(typeof QUICK_REPLY_VARS)[number], string>>) {
  return body
    .replace(/\{(nombre|pedido|producto|total|ciudad|direccion|transportadora|guia)\}/g, (_, k: (typeof QUICK_REPLY_VARS)[number]) => vars[k] || '')
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

// ---------- team (who handles each chat) ----------
// Same shape as tags: a name and a color.
export type Agent = CrmTag;
export const cleanAgents = (input: unknown): Agent[] | string => {
  const r = cleanTags(input);
  return typeof r === 'string' ? r.replace('etiqueta', 'persona').replace('etiquetas', 'personas') : r;
};

// ---------- shipping ----------

export const CARRIERS = ['Servientrega', 'Interrapidísimo', 'Coordinadora', 'Envía', 'TCC', 'Deprisa', '99 Minutos', 'Mensajería propia'];

// ---------- automatic replies ----------

export interface AutoRule {
  id: string;
  enabled: boolean;
  keywords: string[]; // any of them, as whole words ("precio", "cuanto cuesta")
  reply: string; // may use {nombre}
}

export interface AwaySettings {
  enabled: boolean;
  days: number[]; // working days, 0 = Sunday … 6 = Saturday
  start: string; // "08:00"
  end: string; // "18:00"
  message: string;
}

export interface AutoSettings {
  timezone: string;
  away: AwaySettings;
  rules: AutoRule[];
}

export const TIMEZONES = [
  { id: 'America/Bogota', label: 'Colombia' },
  { id: 'America/Mexico_City', label: 'México (centro)' },
  { id: 'America/Lima', label: 'Perú' },
  { id: 'America/Guayaquil', label: 'Ecuador' },
  { id: 'America/Panama', label: 'Panamá' },
  { id: 'America/Santiago', label: 'Chile' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Argentina' },
  { id: 'America/Caracas', label: 'Venezuela' },
  { id: 'America/Guatemala', label: 'Guatemala' },
  { id: 'Europe/Madrid', label: 'España' },
];

export const DEFAULT_AUTO: AutoSettings = {
  timezone: 'America/Bogota',
  away: {
    enabled: false,
    days: [1, 2, 3, 4, 5, 6],
    start: '08:00',
    end: '18:00',
    message: '¡Hola {nombre}! 👋 Gracias por escribirnos. En este momento estamos fuera de horario (lunes a sábado, 8 a. m. a 6 p. m.). Te respondemos apenas volvamos. 🙌',
  },
  rules: [
    {
      id: 'precio',
      enabled: false,
      keywords: ['precio', 'cuanto cuesta', 'cuanto vale', 'valor'],
      reply: '¡Hola {nombre}! Los precios y ofertas vigentes están en la página del producto. El pago es contraentrega 💵 y el envío es gratis. ¿Te ayudo con tu pedido?',
    },
    {
      id: 'envio',
      enabled: false,
      keywords: ['envio', 'domicilio', 'cuanto demora', 'cuando llega'],
      reply: 'Hacemos envíos a toda Colombia 🚚 Llega en 2 a 5 días hábiles y pagas al recibir.',
    },
    {
      id: 'pago',
      enabled: false,
      keywords: ['contraentrega', 'como pago', 'formas de pago', 'medios de pago'],
      reply: 'El pago es contraentrega 💵: pagas en efectivo cuando recibes el producto en tu casa.',
    },
  ],
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const normText = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function cleanAuto(input: any): AutoSettings | string {
  const tz = TIMEZONES.some((t) => t.id === input?.timezone) ? input.timezone : DEFAULT_AUTO.timezone;
  const a = input?.away || {};
  const days = Array.isArray(a.days) ? Array.from(new Set(a.days.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))) : [];
  if (a.enabled && !days.length) return 'Elige al menos un día de atención.';
  if (!HHMM.test(String(a.start)) || !HHMM.test(String(a.end))) return 'Escribe las horas como 08:00.';
  if (String(a.start) === String(a.end)) return 'La hora de inicio y de cierre no pueden ser iguales.';
  const message = String(a.message ?? '').trim().slice(0, 1000);
  if (a.enabled && !message) return 'Escribe el mensaje de fuera de horario.';
  if (!Array.isArray(input?.rules) || input.rules.length > 30) return 'Máximo 30 respuestas automáticas.';
  const rules: AutoRule[] = [];
  for (const r of input.rules) {
    const keywords = Array.from(new Set((Array.isArray(r?.keywords) ? r.keywords : String(r?.keywords ?? '').split(',')).map((k: unknown) => normText(String(k))).filter(Boolean))).slice(0, 20) as string[];
    const reply = String(r?.reply ?? '').trim().slice(0, 1000);
    if (!keywords.length && !reply) continue; // empty row
    if (!keywords.length) return 'Cada respuesta automática necesita al menos una palabra clave.';
    if (!reply) return `Escribe la respuesta para "${keywords[0]}".`;
    const id = /^[\w-]{1,40}$/.test(String(r?.id ?? '')) ? String(r.id) : `r-${Math.random().toString(36).slice(2, 8)}`;
    rules.push({ id, enabled: Boolean(r?.enabled), keywords, reply });
  }
  return { timezone: tz, away: { enabled: Boolean(a.enabled), days: days as number[], start: String(a.start), end: String(a.end), message }, rules };
}

// Local day and "HH:MM" in a time zone.
export function localTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, hhmm: `${get('hour')}:${get('minute')}` };
}

// Inside working hours? Supports overnight ranges (e.g. 20:00–02:00).
export function isWorkingTime(away: AwaySettings, timeZone: string, date = new Date()): boolean {
  const { day, hhmm } = localTime(date, timeZone);
  if (away.start < away.end) return away.days.includes(day) && hhmm >= away.start && hhmm < away.end;
  // overnight: the late part belongs to "day", the early part to the day before
  if (hhmm >= away.start) return away.days.includes(day);
  return hhmm < away.end && away.days.includes((day + 6) % 7);
}

// First enabled rule with a keyword in the message (whole words, accents ignored).
export function matchRule(rules: AutoRule[], text: string): AutoRule | null {
  const t = ` ${normText(text)} `;
  if (!t.trim()) return null;
  return rules.find((r) => r.enabled && r.keywords.some((k) => k && t.includes(` ${k} `))) || null;
}
