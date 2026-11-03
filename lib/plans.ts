// Plans and prices of the platform (shared by the panel and the server).
// The platform admin can change them in /admin (saved in platform_settings, row "plans").

export type PlanId = 'basico' | 'pro' | 'escala';

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // COP per month
  landings: number | null; // null = unlimited
  ordersPerMonth: number | null; // soft limit: orders are never rejected, the panel warns
  members: number | null;
  aiReplies: number; // assistant replies per month included free with the platform's Claude key
  extraStorePrice: number; // COP per month for each store after the owner's first one
  features: string[];
  highlight?: boolean;
}

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'basico',
    name: 'Básico',
    price: 99000,
    landings: 5,
    ordersPerMonth: null,
    members: null,
    aiReplies: 300,
    extraStorePrice: 49000,
    features: ['300 respuestas de IA gratis al mes', '5 landings con IA', 'Pedidos y equipo ilimitados', 'WhatsApp, Messenger e Instagram en Mensajes', 'Flujos, tablero y comentarios'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199000,
    landings: 20,
    ordersPerMonth: null,
    members: null,
    aiReplies: 1500,
    extraStorePrice: 99000,
    features: ['1.500 respuestas de IA gratis al mes', '20 landings con IA', 'Pedidos y equipo ilimitados', 'Llamadas con IA y notas de voz', 'Todo lo del Básico'],
    highlight: true,
  },
  {
    id: 'escala',
    name: 'Escala',
    price: 399000,
    landings: null,
    ordersPerMonth: null,
    members: null,
    aiReplies: 4000,
    extraStorePrice: 199000,
    features: ['4.000 respuestas de IA gratis al mes', 'Landings ilimitadas', 'Pedidos y equipo ilimitados', 'Soporte prioritario', 'Todo lo del Pro'],
  },
];

// Paying several months at once.
export const PREPAY: { months: number; discount: number; label: string }[] = [
  { months: 1, discount: 0, label: '1 mes' },
  { months: 3, discount: 0.1, label: '3 meses' },
  { months: 6, discount: 0.15, label: '6 meses' },
  { months: 12, discount: 0.25, label: '12 meses' },
];
export const prepayDiscount = (months: number) => PREPAY.find((p) => p.months === months)?.discount ?? 0;
// Total of a prepaid period (rounded to hundreds of pesos).
export const prepayTotal = (monthly: number, months: number) => Math.round((monthly * months * (1 - prepayDiscount(months))) / 100) * 100;

// Extra AI replies for when the month's free ones run out (they don't expire).
export const AI_PACK = { replies: 1000, price: 79000 };

// Each store after the owner's first one gets half the plan's free AI replies.
export const extraStoreAi = (plan: Plan) => Math.round(plan.aiReplies / 2);

// How much a reply weighs by model: the most capable one counts double, the cheapest a quarter.
export const MODEL_WEIGHT: Record<string, number> = { quality: 2, balanced: 1, economy: 0.25 };

export const TRIAL_DAYS = 7;
export const TRIAL_PLAN: PlanId = 'pro';
export const TRIAL_AI_REPLIES = 100; // the trial includes a taste of the assistant
export const GRACE_DAYS = 3; // after expiring, landings keep selling this many days

export type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'exempt';

export const STATUS_LABEL: Record<SubStatus, string> = {
  trialing: 'Prueba gratis',
  active: 'Activo',
  past_due: 'Pago pendiente',
  canceled: 'Cancelado',
  expired: 'Vencido',
  exempt: 'Sin costo',
};

export const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
export const limitText = (n: number | null, unit: string) => (n === null ? `${unit} ilimitados` : `${n.toLocaleString('es-CO')} ${unit}`);

export function cleanPlans(input: unknown): Plan[] | string {
  if (!Array.isArray(input)) return 'Lista de planes inválida.';
  const out: Plan[] = [];
  for (const d of DEFAULT_PLANS) {
    const p = (input as any[]).find((x) => x?.id === d.id) || {};
    const num = (v: unknown, min: number) => (v === null || v === '' ? null : Number.isFinite(Number(v)) && Number(v) >= min ? Math.round(Number(v)) : undefined);
    const price = num(p.price, 1000);
    if (price === undefined || price === null) return `Precio inválido en el plan ${d.name}.`;
    const landings = num(p.landings, 1);
    const orders = num(p.ordersPerMonth, 1);
    const members = num(p.members, 1);
    const ai = num(p.aiReplies, 0);
    const extra = num(p.extraStorePrice ?? d.extraStorePrice, 0);
    if (landings === undefined || orders === undefined || members === undefined || ai === undefined || ai === null) return `Revisa los límites del plan ${d.name}.`;
    if (extra === undefined || extra === null) return `Revisa el precio de la tienda extra del plan ${d.name}.`;
    const features = Array.isArray(p.features) ? p.features.map((f: unknown) => String(f).trim().slice(0, 80)).filter(Boolean).slice(0, 8) : d.features;
    out.push({ id: d.id, name: String(p.name || d.name).trim().slice(0, 30) || d.name, price, landings, ordersPerMonth: orders, members, aiReplies: ai, extraStorePrice: extra, features, highlight: d.id === 'pro' });
  }
  return out;
}
