// Vapi (AI phone calls). Server-only: uses the private API key.
import { fillTemplate, type VoiceConfig } from '@/lib/voice-config';
import { formatMoney } from '@/lib/whatsapp-link';

// Overridable for tests or a proxy; defaults to Vapi's API.
const API = (process.env.VAPI_API_BASE_URL || 'https://api.vapi.ai').replace(/\/+$/, '');
const env = (k: string) => (process.env[k] || '').trim();

export const VAPI_ENV = ['VAPI_API_KEY', 'VAPI_PHONE_NUMBER_ID', 'VAPI_WEBHOOK_SECRET'] as const;

export function vapiEnabled(): boolean {
  return Boolean(env('VAPI_API_KEY') && env('VAPI_PHONE_NUMBER_ID'));
}

export function vapiStatus() {
  return {
    ready: vapiEnabled(),
    webhookSecret: Boolean(env('VAPI_WEBHOOK_SECRET')),
    cron: Boolean(env('CRON_SECRET')),
    missing: VAPI_ENV.filter((k) => !env(k)),
  };
}

export function webhookSecret(): string {
  return env('VAPI_WEBHOOK_SECRET');
}

// Public base URL of this deployment (Vapi must reach the webhook).
export function publicBaseUrl(fallbackOrigin?: string): string {
  const explicit = env('PUBLIC_BASE_URL') || env('NEXT_PUBLIC_SITE_URL');
  if (explicit) return explicit.replace(/\/+$/, '');
  if (env('VERCEL_PROJECT_PRODUCTION_URL')) return `https://${env('VERCEL_PROJECT_PRODUCTION_URL')}`;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, '');
  if (env('VERCEL_URL')) return `https://${env('VERCEL_URL')}`;
  return '';
}

async function vapiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('VAPI_API_KEY')}`, ...(init?.headers || {}) },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join('; ') : data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Vapi: ${msg}`);
  }
  return data;
}

// ---------- assistant ----------

export interface CallOrderInfo {
  orderNumber: string;
  customerName: string;
  productName: string;
  comboName: string;
  units: number;
  totalAmount: number;
  currency: string;
  address: string;
  city: string;
  department?: string;
  notes?: string;
}

export const RESULT_TOOL = 'registrar_resultado';

function systemPrompt(o: CallOrderInfo, cfg: VoiceConfig, store: string): string {
  const total = formatMoney(o.totalAmount, o.currency);
  return `Eres ${cfg.agentName}, asesora de ${store}. Estás en una llamada telefónica con ${o.customerName} para confirmar un pedido que hizo por internet con pago contraentrega (paga en efectivo al recibir).

DATOS DEL PEDIDO (no los cambies ni inventes otros):
- Pedido: ${o.orderNumber}
- Producto: ${o.productName}
- Oferta: ${o.comboName} (${o.units} ${o.units === 1 ? 'unidad' : 'unidades'})
- Total a pagar al recibir: ${total}
- Dirección: ${o.address}
- Ciudad: ${o.city}${o.department ? `, ${o.department}` : ''}${o.notes ? `\n- Indicaciones del cliente: ${o.notes}` : ''}

CÓMO HACER LA LLAMADA:
1. Confirma que hablas con ${o.customerName}. Si no es la persona, pregunta con amabilidad si puede pasarle o cuándo llamar.
2. Confirma el producto, la cantidad y el total a pagar en efectivo.
3. Lee la dirección y la ciudad y pregunta si están correctas. Si el cliente la corrige, repítela para verificarla.
4. Pregunta si habrá alguien para recibir el paquete y pagar.
5. Cuando el cliente decida, llama a la herramienta ${RESULT_TOOL} UNA sola vez y después despídete con una frase corta y cuelga.

RESULTADOS POSIBLES DE ${RESULT_TOOL}:
- "confirmado": el cliente confirma el pedido (con la dirección correcta o corregida).
- "cancelado": no lo quiere, no lo pidió o pide cancelar. No insistas más de una vez.
- "volver_a_llamar": no puede hablar ahora o no es la persona y piden llamar después.
- "revisar": quiere cambiar producto o cantidad, tiene un reclamo, dudas que no puedes resolver, o la situación no es clara.

REGLAS:
- Habla en español, con frases cortas, natural y amable. Trata al cliente de "usted".
- Di los precios en palabras naturales (por ejemplo "ciento veintinueve mil novecientos pesos").
- No ofrezcas descuentos, regalos ni fechas de entrega exactas. Si preguntan cuándo llega, di que el equipo le confirmará el envío por WhatsApp.
- Nunca pidas datos de tarjetas ni contraseñas.
- Si te preguntan si eres un robot, di con naturalidad que eres una asistente virtual de ${store}.${cfg.extraInstructions.trim() ? `\n\nINSTRUCCIONES ADICIONALES DE LA TIENDA:\n${cfg.extraInstructions.trim()}` : ''}`;
}

function buildAssistant(o: CallOrderInfo, cfg: VoiceConfig, store: string, webhookUrl: string) {
  const headers: Record<string, string> = webhookSecret() ? { 'x-logipages-secret': webhookSecret() } : {};
  const server = { url: webhookUrl, headers, timeoutSeconds: 20 };
  const firstName = o.customerName.trim().split(/\s+/)[0] || o.customerName;
  return {
    name: `Confirmación ${o.orderNumber}`.slice(0, 40),
    firstMessage: fillTemplate(cfg.firstMessage, { cliente: firstName, tienda: store, producto: o.productName, agente: cfg.agentName }),
    firstMessageMode: 'assistant-speaks-first',
    transcriber: { provider: 'deepgram', model: 'nova-3', language: 'es' },
    voice: { provider: 'azure', voiceId: cfg.voiceId },
    model: {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      messages: [{ role: 'system', content: systemPrompt(o, cfg, store) }],
      tools: [
        {
          type: 'function',
          function: {
            name: RESULT_TOOL,
            description: 'Guarda el resultado de la confirmación del pedido. Llámala una sola vez, cuando el cliente ya decidió.',
            parameters: {
              type: 'object',
              properties: {
                resultado: { type: 'string', enum: ['confirmado', 'cancelado', 'volver_a_llamar', 'revisar'], description: 'Decisión del cliente.' },
                direccion_corregida: { type: 'string', description: 'Dirección completa corregida, solo si el cliente la cambió.' },
                notas: { type: 'string', description: 'Resumen breve de lo importante (motivo de cancelación, cuándo volver a llamar, cambios pedidos).' },
              },
              required: ['resultado'],
            },
          },
          server,
        },
        { type: 'endCall' },
      ],
    },
    voicemailDetection: { provider: 'vapi' },
    maxDurationSeconds: 300,
    endCallMessage: 'Muchas gracias, que tenga un buen día.',
    serverMessages: ['status-update', 'tool-calls', 'end-of-call-report'],
    analysisPlan: {
      summaryPlan: {
        enabled: true,
        messages: [
          { role: 'system', content: 'Resume en español, en 1 o 2 frases, el resultado de esta llamada de confirmación de pedido contraentrega.' },
          { role: 'user', content: 'Transcripción:\n\n{{transcript}}\n\nMotivo de finalización: {{endedReason}}' },
        ],
      },
    },
    server,
  };
}

// Places the outbound call. Returns Vapi's call id.
export async function createVapiCall(p: { phoneE164: string; order: CallOrderInfo; cfg: VoiceConfig; store: string; webhookUrl: string }) {
  const data = await vapiFetch('/call', {
    method: 'POST',
    body: JSON.stringify({
      name: `Pedido ${p.order.orderNumber}`.slice(0, 40),
      phoneNumberId: env('VAPI_PHONE_NUMBER_ID'),
      customer: { number: p.phoneE164, name: p.order.customerName.slice(0, 40) },
      assistant: buildAssistant(p.order, p.cfg, p.store, p.webhookUrl),
    }),
  });
  if (!data?.id) throw new Error('Vapi no devolvió el id de la llamada.');
  return { id: String(data.id), status: String(data.status || 'queued') };
}

export interface VapiCall {
  id: string;
  status?: string;
  endedReason?: string;
  startedAt?: string;
  endedAt?: string;
  cost?: number;
  analysis?: { summary?: string };
  artifact?: { transcript?: string; recordingUrl?: string; recording?: { mono?: { combinedUrl?: string } }; messages?: { role: string; message?: string; secondsFromStart?: number }[] };
}

export function getVapiCall(id: string): Promise<VapiCall> {
  return vapiFetch(`/call/${encodeURIComponent(id)}`);
}

// ---------- results ----------

export type CallOutcome = 'confirmed' | 'cancelled' | 'callback' | 'review';

const OUTCOME: Record<string, CallOutcome> = { confirmado: 'confirmed', cancelado: 'cancelled', volver_a_llamar: 'callback', revisar: 'review' };

export interface ToolResult {
  toolCallId: string;
  outcome: CallOutcome | null;
  correctedAddress?: string;
  notes?: string;
}

// Reads the "registrar_resultado" calls from a tool-calls message.
export function parseToolCalls(message: any): ToolResult[] {
  const list: any[] = Array.isArray(message?.toolCallList) ? message.toolCallList : [];
  return list
    .filter((t) => (t?.function?.name || t?.name) === RESULT_TOOL && t?.id)
    .map((t) => {
      let args: any = t.function?.arguments ?? t.arguments ?? {};
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch {
          args = {};
        }
      }
      const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
      return {
        toolCallId: String(t.id),
        outcome: OUTCOME[String(args?.resultado || '')] || null,
        correctedAddress: clean(args?.direccion_corregida, 300),
        notes: clean(args?.notas, 600),
      };
    });
}

// Ended reasons that mean nobody really talked: worth trying again later.
export function isNoAnswer(endedReason?: string): boolean {
  if (!endedReason) return false;
  return (
    ['customer-did-not-answer', 'customer-busy', 'voicemail', 'customer-did-not-give-microphone-permission'].includes(endedReason) ||
    /failed-to-connect|misdialed|no-answer|busy|transport-never-connected/.test(endedReason)
  );
}

export function recordingUrl(c: VapiCall): string | undefined {
  return c.artifact?.recordingUrl || c.artifact?.recording?.mono?.combinedUrl || undefined;
}

export function transcriptLines(c: VapiCall): { role: 'agent' | 'customer'; text: string; at?: number }[] {
  return (c.artifact?.messages || [])
    .filter((m) => (m.role === 'bot' || m.role === 'assistant' || m.role === 'user') && m.message)
    .map((m) => ({ role: m.role === 'user' ? ('customer' as const) : ('agent' as const), text: String(m.message), at: m.secondsFromStart }));
}
