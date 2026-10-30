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
  aiReplies: number; // assistant replies per month with the platform's Claude key (0 = only with the store's own key)
  features: string[];
  highlight?: boolean;
}

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'basico',
    name: 'Básico',
    price: 99000,
    landings: 3,
    ordersPerMonth: 300,
    members: 2,
    aiReplies: 0,
    features: ['3 landings con IA', '300 pedidos al mes', '2 personas', 'WhatsApp, Mensajes y Pedidos', 'Asistente IA con tu propia clave'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199000,
    landings: 15,
    ordersPerMonth: 2000,
    members: 5,
    aiReplies: 1000,
    features: ['15 landings con IA', '2.000 pedidos al mes', '5 personas', '1.000 respuestas del asistente IA incluidas', 'Todo lo del Básico'],
    highlight: true,
  },
  {
    id: 'escala',
    name: 'Escala',
    price: 399000,
    landings: null,
    ordersPerMonth: null,
    members: 15,
    aiReplies: 3000,
    features: ['Landings ilimitadas', 'Pedidos ilimitados', '15 personas', '3.000 respuestas del asistente IA incluidas', 'Todo lo del Pro'],
  },
];

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
    if (landings === undefined || orders === undefined || members === undefined || ai === undefined || ai === null) return `Revisa los límites del plan ${d.name}.`;
    const features = Array.isArray(p.features) ? p.features.map((f: unknown) => String(f).trim().slice(0, 80)).filter(Boolean).slice(0, 8) : d.features;
    out.push({ id: d.id, name: String(p.name || d.name).trim().slice(0, 30) || d.name, price, landings, ordersPerMonth: orders, members, aiReplies: ai, features, highlight: d.id === 'pro' });
  }
  return out;
}
