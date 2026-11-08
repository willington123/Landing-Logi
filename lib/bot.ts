// WhatsApp AI assistant (Claude): settings shared by the panel and the server.

export interface BotSettings {
  enabled: boolean;
  mode: 'always' | 'away'; // always, or only outside working hours (the hours set in Automatizaciones)
  name: string; // how the assistant introduces itself, e.g. "Sofía"
  formal: boolean; // usted instead of tú
  businessInfo: string; // shipping, payment, guarantee, returns, hours… written by the owner
  maxRepliesPerDay: number; // per customer; after that the chat goes to a person
  takeOrders: boolean; // close the sale in the chat (creates the order) instead of sending the customer to the landing
  followUp: FollowUpSettings; // one message to customers who stopped answering without ordering
  model: BotModel; // which Claude model answers the chats
  social: boolean; // also answer Messenger and Instagram chats
  handoffRules: string; // extra cases, written by the store, when the assistant passes the chat to a person (one per line)
  resumeAfterHours: number; // a chat a person took over goes back to the assistant after this many hours without a person writing (0 = never)
}

// The store's own instructions and information (about 20 pages). The assistant reads them on every reply (cached).
export const MAX_BUSINESS_INFO = 60_000;

export type BotModel = 'quality' | 'balanced' | 'economy';
export const BOT_MODELS: { id: BotModel; label: string; hint: string; price: { input: number; output: number; cacheRead: number; cacheWrite: number } }[] = [
  { id: 'quality', label: 'Máxima calidad (Opus)', hint: 'El más inteligente. Para productos caros o clientes difíciles. Cuesta el doble que Equilibrado.', price: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 } },
  { id: 'balanced', label: 'Equilibrado (Sonnet)', hint: 'Recomendado. Vende y agenda muy bien a la mitad del costo de Opus.', price: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 } },
  { id: 'economy', label: 'Económico (Haiku)', hint: 'Muy barato y rápido. Bien para preguntas simples; menos hábil cerrando ventas.', price: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 } },
];

export interface FollowUpSettings {
  enabled: boolean;
  afterHours: number; // hours of silence before the message (inside WhatsApp's free 24 h window)
  onlyAds: boolean; // only chats that came from a WhatsApp ad
}
export const FOLLOW_UP_HOURS = [1, 2, 3, 4, 6, 12, 20];
export const RESUME_HOURS = [0, 2, 4, 8, 12, 24, 48];
export const DEFAULT_FOLLOW_UP: FollowUpSettings = { enabled: false, afterHours: 3, onlyAds: true };

export const DEFAULT_BOT: BotSettings = {
  enabled: false,
  mode: 'always',
  name: 'Sofía',
  formal: false,
  businessInfo: [
    'Envíos: a toda Colombia, gratis. Llega en 2 a 5 días hábiles según la ciudad.',
    'Pago: contraentrega, en efectivo al recibir el producto. No pedimos pagos por adelantado.',
    'Garantía: si el producto llega dañado o con defectos, lo cambiamos. El cliente envía una foto por este chat.',
    'Cambios de dirección: se pueden hacer antes de que el pedido sea despachado.',
    'Horario de atención de personas: lunes a sábado de 8 a. m. a 6 p. m.',
  ].join('\n'),
  maxRepliesPerDay: 30,
  takeOrders: true,
  followUp: DEFAULT_FOLLOW_UP,
  model: 'balanced',
  social: true,
  handoffRules: '',
  resumeAfterHours: 12,
};

export function cleanFollowUp(f: any): FollowUpSettings {
  const h = Number(f?.afterHours);
  return {
    enabled: Boolean(f?.enabled),
    afterHours: FOLLOW_UP_HOURS.includes(h) ? h : DEFAULT_FOLLOW_UP.afterHours,
    onlyAds: f?.onlyAds === undefined ? DEFAULT_FOLLOW_UP.onlyAds : Boolean(f.onlyAds),
  };
}

export function cleanBot(input: any): BotSettings | string {
  const name = String(input?.name ?? '').trim().slice(0, 40);
  const businessInfo = String(input?.businessInfo ?? '').trim().slice(0, MAX_BUSINESS_INFO);
  const max = Math.round(Number(input?.maxRepliesPerDay));
  if (!name) return 'Ponle un nombre al asistente.';
  if (input?.enabled && businessInfo.length < 20) return 'Escribe la información de tu negocio: el asistente solo responde con lo que está ahí y en tus landings.';
  return {
    enabled: Boolean(input?.enabled),
    mode: input?.mode === 'away' ? 'away' : 'always',
    name,
    formal: Boolean(input?.formal),
    businessInfo,
    maxRepliesPerDay: Number.isFinite(max) ? Math.min(100, Math.max(5, max)) : DEFAULT_BOT.maxRepliesPerDay,
    takeOrders: input?.takeOrders === undefined ? DEFAULT_BOT.takeOrders : Boolean(input.takeOrders),
    followUp: cleanFollowUp(input?.followUp),
    model: BOT_MODELS.some((m) => m.id === input?.model) ? input.model : DEFAULT_BOT.model,
    social: input?.social === undefined ? DEFAULT_BOT.social : Boolean(input.social),
    handoffRules: String(input?.handoffRules ?? '')
      .split('\n')
      .map((l) => l.replace(/^[\s\-•*\d.)]+/, '').trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 15)
      .join('\n'),
    resumeAfterHours: RESUME_HOURS.includes(Number(input?.resumeAfterHours)) ? Number(input.resumeAfterHours) : DEFAULT_BOT.resumeAfterHours,
  };
}

// Per-conversation state: paused when a person takes over.
export interface BotChatState {
  paused?: boolean;
  pausedAt?: string;
  reason?: 'human' | 'handoff' | 'limit' | 'error';
  note?: string; // why it handed over (shown in the chat)
  day?: string; // yyyy-mm-dd of the counter below
  replies?: number; // bot replies that day
  mediaSent?: Record<string, { photos?: string; audio?: string; images?: Record<string, string> }>; // product id → when its photos (each one by link) / voice note were sent here
}

// A paused chat goes back to the assistant: a person took it (or the assistant handed it over) and no person
// has written in it for the hours the store chose. Limit and error pauses are not resumed here.
export function shouldResume(state: BotChatState, s: Pick<BotSettings, 'resumeAfterHours'>, now = Date.now()): boolean {
  if (!state.paused || !s.resumeAfterHours || (state.reason !== 'handoff' && state.reason !== 'human')) return false;
  const at = state.pausedAt ? new Date(state.pausedAt).getTime() : NaN;
  return Number.isFinite(at) && now - at >= s.resumeAfterHours * 3600_000;
}

// The store's own handoff cases, as lines for the assistant's instructions.
export const handoffRulesText = (s: Pick<BotSettings, 'handoffRules'>) =>
  s.handoffRules
    ? `\n- La tienda también pide usar pasar_a_humano en estos casos:\n${s.handoffRules
        .split('\n')
        .filter(Boolean)
        .map((l) => `  • ${l}`)
        .join('\n')}`
    : '';

export const PAUSE_REASON: Record<NonNullable<BotChatState['reason']>, string> = {
  human: 'Respondiste tú',
  handoff: 'El asistente lo pasó a una persona',
  limit: 'Llegó al límite de respuestas del día',
  error: 'El asistente tuvo un error',
};
