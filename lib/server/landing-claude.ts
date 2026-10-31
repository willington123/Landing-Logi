// Landing copy, design and image prompts written by Claude (looks at the product photo). The page keeps the
// same JSON shape the editor already uses; Gemini stays as the fallback writer.
import Anthropic from '@anthropic-ai/sdk';
import { anthropicKey } from '@/lib/server/integrations';
import { addAiReply } from '@/lib/server/billing';

export const LANDING_MODEL = process.env.ANTHROPIC_LANDING_MODEL || 'claude-opus-5-5';
// A whole landing counts as this many assistant replies against a plan's included AI.
const LANDING_COST_IN_REPLIES = 10;

export class ClaudeLandingError extends Error {
  constructor(
    message: string,
    public retryWithFallback = true,
  ) {
    super(message);
  }
}

// Gemini-style schema (OBJECT/STRING/ARRAY, minItems…) → JSON Schema for structured outputs
// (lowercase types, additionalProperties: false on every object, no array length constraints).
export function toJsonSchema(s: any): any {
  if (!s || typeof s !== 'object') return s;
  const type = String(s.type || '').toLowerCase();
  if (type === 'object') {
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.properties || {})) properties[k] = toJsonSchema(v);
    return { type: 'object', properties, required: s.required || Object.keys(properties), additionalProperties: false };
  }
  if (type === 'array') return { type: 'array', items: toJsonSchema(s.items) };
  const out: any = { type };
  if (Array.isArray(s.enum)) out.enum = s.enum;
  return out;
}

type ImageMedia = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
const MEDIA: ImageMedia[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function imageBlock(dataUrl: string): Anthropic.Beta.BetaImageBlockParam | null {
  const m = /^data:(image\/[\w+.-]+);base64,([\s\S]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const media = (m[1] === 'image/jpg' ? 'image/jpeg' : m[1]) as ImageMedia;
  if (!MEDIA.includes(media)) return null;
  if (m[2].length > 5_000_000) return null; // the API limit is 5 MB per image
  return { type: 'image', source: { type: 'base64', media_type: media, data: m[2] } };
}

const SYSTEM = `Eres el mejor director creativo y copywriter de respuesta directa de Latinoamérica para tiendas de e-commerce con pago contraentrega. Escribes landing pages que se sienten de marca premium (nivel de las mejores tiendas Shopify) y que venden: claras, específicas para ESE producto, emocionales sin exagerar, y honestas.
Miras con atención las fotos del producto (forma, materiales, colores, detalles, para quién es) y las usas para escribir y para elegir la paleta.
Respondes solo con el JSON pedido, en español neutro latinoamericano, siguiendo al pie de la letra las reglas y cantidades del encargo.`;

// Writes the landing. Throws ClaudeLandingError when Claude isn't available or fails (caller falls back).
export async function writeLandingWithClaude(p: { orgId: string | null; prompt: string; images: string[]; schema: unknown }): Promise<{ copy: any; model: string }> {
  const key = await anthropicKey(p.orgId);
  if (!key) throw new ClaudeLandingError('Claude no está conectado en esta tienda.');
  const images = p.images.map(imageBlock).filter((b): b is Anthropic.Beta.BetaImageBlockParam => Boolean(b));
  if (!images.length) throw new ClaudeLandingError('La foto no está en un formato que Claude pueda leer (JPG, PNG, WEBP o GIF).');

  const client = new Anthropic({ apiKey: key.key, timeout: 200_000, maxRetries: 1 });
  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = client.beta.messages.stream({
      model: LANDING_MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema', schema: toJsonSchema(p.schema) } },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: [...images, { type: 'text', text: p.prompt }] }],
    });
    message = await stream.finalMessage();
  } catch (e: any) {
    if (e instanceof Anthropic.AuthenticationError) throw new ClaudeLandingError('La clave de Claude no es válida.');
    if (e instanceof Anthropic.RateLimitError) throw new ClaudeLandingError('Claude está ocupado (límite de uso).');
    if (e instanceof Anthropic.APIError) throw new ClaudeLandingError(`Claude respondió con un error (${e.status}): ${e.message}`);
    throw new ClaudeLandingError(`No se pudo hablar con Claude: ${e?.message || e}`);
  }
  if (message.stop_reason === 'refusal') throw new ClaudeLandingError('Claude no quiso escribir esta landing.');
  if (message.stop_reason === 'max_tokens') throw new ClaudeLandingError('La respuesta de Claude quedó incompleta.');
  const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let copy: any;
  try {
    copy = JSON.parse(text);
  } catch {
    throw new ClaudeLandingError('Claude devolvió una respuesta que no se pudo leer.');
  }
  if (key.source === 'plan' && p.orgId) await addAiReply(p.orgId, LANDING_COST_IN_REPLIES).catch(() => {});
  return { copy, model: message.model };
}

// Claude available for this store (its own key, the Vercel key, or the plan's included replies)?
export async function claudeLandingAvailable(orgId: string | null) {
  return Boolean(await anthropicKey(orgId).catch(() => null));
}
