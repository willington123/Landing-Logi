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
}

export interface FollowUpSettings {
  enabled: boolean;
  afterHours: number; // hours of silence before the message (inside WhatsApp's free 24 h window)
  onlyAds: boolean; // only chats that came from a WhatsApp ad
}
export const FOLLOW_UP_HOURS = [1, 2, 3, 4, 6, 12, 20];
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
  const businessInfo = String(input?.businessInfo ?? '').trim().slice(0, 6000);
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
}

export const PAUSE_REASON: Record<NonNullable<BotChatState['reason']>, string> = {
  human: 'Respondiste tú',
  handoff: 'El asistente lo pasó a una persona',
  limit: 'Llegó al límite de respuestas del día',
  error: 'El asistente tuvo un error',
};
