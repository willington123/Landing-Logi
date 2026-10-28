// AI call settings (shared by the panel and the server). Secrets live in env vars, not here.

export interface VoiceConfig {
  autoCall: boolean; // call every new order automatically
  agentName: string;
  voiceId: string; // Azure neural voice used by Vapi
  firstMessage: string; // supports {{cliente}}, {{tienda}}, {{producto}}, {{agente}}
  extraInstructions: string; // added to the built-in script
  timezone: string;
  hoursStart: string; // "08:30"
  hoursEnd: string; // "19:30"
  delayMinutes: number; // wait after the order before the first call
  maxAttempts: number;
  retryMinutes: number;
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  autoCall: false,
  agentName: 'Valentina',
  voiceId: 'es-CO-SalomeNeural',
  firstMessage: 'Hola, ¿hablo con {{cliente}}? Le habla {{agente}} de {{tienda}}. Le llamo para confirmar el pedido de {{producto}} que hizo por internet. ¿Tiene un minuto?',
  extraInstructions: '',
  timezone: 'America/Bogota',
  hoursStart: '08:30',
  hoursEnd: '19:30',
  delayMinutes: 0,
  maxAttempts: 3,
  retryMinutes: 60,
};

export const VOICES: { id: string; label: string }[] = [
  { id: 'es-CO-SalomeNeural', label: 'Salomé — Colombia (mujer)' },
  { id: 'es-CO-GonzaloNeural', label: 'Gonzalo — Colombia (hombre)' },
  { id: 'es-MX-DaliaNeural', label: 'Dalia — México (mujer)' },
  { id: 'es-MX-JorgeNeural', label: 'Jorge — México (hombre)' },
  { id: 'es-PE-CamilaNeural', label: 'Camila — Perú (mujer)' },
  { id: 'es-CL-CatalinaNeural', label: 'Catalina — Chile (mujer)' },
  { id: 'es-EC-AndreaNeural', label: 'Andrea — Ecuador (mujer)' },
  { id: 'es-GT-MartaNeural', label: 'Marta — Guatemala (mujer)' },
  { id: 'es-ES-ElviraNeural', label: 'Elvira — España (mujer)' },
  { id: 'es-ES-AlvaroNeural', label: 'Álvaro — España (hombre)' },
];

export const TIMEZONES: { id: string; label: string }[] = [
  { id: 'America/Bogota', label: 'Colombia / Perú / Ecuador (UTC-5)' },
  { id: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { id: 'America/Santiago', label: 'Chile' },
  { id: 'America/Guatemala', label: 'Guatemala' },
  { id: 'Europe/Madrid', label: 'España' },
];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const text = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.slice(0, max) : fallback);

// Accepts anything (from the browser or the database) and returns a valid config.
export function sanitizeVoiceConfig(input: unknown): VoiceConfig {
  const i = (input && typeof input === 'object' ? input : {}) as Partial<VoiceConfig>;
  const d = DEFAULT_VOICE_CONFIG;
  const tzOk = (tz: unknown) => {
    if (typeof tz !== 'string' || !tz) return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  };
  return {
    autoCall: typeof i.autoCall === 'boolean' ? i.autoCall : d.autoCall,
    agentName: text(i.agentName, 40, d.agentName).trim() || d.agentName,
    voiceId: typeof i.voiceId === 'string' && /^[a-z]{2}-[A-Z]{2}-\w+Neural$/.test(i.voiceId) ? i.voiceId : d.voiceId,
    firstMessage: text(i.firstMessage, 400, d.firstMessage).trim() || d.firstMessage,
    extraInstructions: text(i.extraInstructions, 3000, d.extraInstructions),
    timezone: tzOk(i.timezone) ? (i.timezone as string) : d.timezone,
    hoursStart: typeof i.hoursStart === 'string' && HHMM.test(i.hoursStart) ? i.hoursStart : d.hoursStart,
    hoursEnd: typeof i.hoursEnd === 'string' && HHMM.test(i.hoursEnd) ? i.hoursEnd : d.hoursEnd,
    delayMinutes: clampInt(i.delayMinutes, 0, 24 * 60, d.delayMinutes),
    maxAttempts: clampInt(i.maxAttempts, 1, 6, d.maxAttempts),
    retryMinutes: clampInt(i.retryMinutes, 10, 24 * 60, d.retryMinutes),
  };
}

// Minutes since midnight in the given time zone.
function localMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return h * 60 + m;
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function withinCallHours(date: Date, cfg: Pick<VoiceConfig, 'timezone' | 'hoursStart' | 'hoursEnd'>): boolean {
  const now = localMinutes(date, cfg.timezone);
  const start = toMinutes(cfg.hoursStart);
  const end = toMinutes(cfg.hoursEnd);
  return start <= end ? now >= start && now < end : now >= start || now < end; // window may cross midnight
}

// First moment at or after `from` that falls inside the call hours (5-minute steps, max 2 days).
export function nextCallTime(from: Date, cfg: Pick<VoiceConfig, 'timezone' | 'hoursStart' | 'hoursEnd'>): Date {
  const t = new Date(from.getTime());
  for (let i = 0; i < 2 * 24 * 12; i++) {
    if (withinCallHours(t, cfg)) return t;
    t.setTime(t.getTime() + 5 * 60 * 1000);
  }
  return from;
}

// Fills {{placeholders}} in the greeting.
export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}
