// Server-side helpers for the Google Gemini REST API.
// The key is sent in the x-goog-api-key header (never in the URL, so it doesn't end up in logs).

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Tried in order. Override with env vars when Google ships newer models.
// "gemini-flash-latest" is Google's alias that always points at the current Flash model.
const TEXT_MODELS = [
  process.env.GEMINI_TEXT_MODEL,
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  // Lite models: lower quality but their own free quota, used when the others are exhausted.
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
].filter(Boolean) as string[];
const IMAGE_MODELS = [
  process.env.GEMINI_IMAGE_MODEL,
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
].filter(Boolean) as string[];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function resolveApiKey(clientKey?: string): string {
  const key = (process.env.GEMINI_API_KEY || clientKey || '').trim();
  if (!key) {
    throw new GeminiError(
      'Falta la API Key de Google Gemini. Consíguela gratis en https://aistudio.google.com/app/apikey',
      400
    );
  }
  return key;
}

// Turns a data URL into a Gemini inline image part.
export function imagePart(dataUrl: string): GeminiPart {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) throw new GeminiError('La imagen debe enviarse como data URL en base64.', 400);
  return { inline_data: { mime_type: match[1], data: match[2] } };
}

async function callModel(apiKey: string, model: string, body: unknown) {
  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new GeminiError(`${model}: ${msg}`, res.status);
  }
  return data;
}

// Tries each model in order; moves on only for "model not available" style errors.
async function withFallback<T>(models: string[], run: (model: string) => Promise<T>): Promise<T> {
  const errors: GeminiError[] = [];
  for (const model of models) {
    try {
      try {
        return await run(model);
      } catch (err) {
        // "High demand" / server hiccup: one quick retry on the same model before moving on.
        if (err instanceof GeminiError && err.status >= 500) {
          await sleep(1500);
          return await run(model);
        }
        throw err;
      }
    } catch (err) {
      const e = err instanceof GeminiError ? err : new GeminiError(err instanceof Error ? err.message : String(err));
      errors.push(e);
      // Bad key: other models won't help. Quota limits (429) are per model on the free
      // tier, so in that case the next model may still work.
      if (e.status === 401 || e.status === 403 || /api key/i.test(e.message)) break;
    }
  }
  // Report every model's failure; the first one is usually the meaningful one.
  const first = errors[0] || new GeminiError('Error desconocido de Gemini');
  throw new GeminiError(errors.map((e) => e.message).join(' | '), first.status);
}

export async function generateJSON<T>(
  apiKey: string,
  parts: GeminiPart[],
  responseSchema: unknown,
  temperature = 0.9
): Promise<T> {
  return withFallback(TEXT_MODELS, async (model) => {
    const base = { responseMimeType: 'application/json', responseSchema, temperature };
    let data;
    try {
      // Low thinking roughly halves response time and the copy quality is the same.
      data = await callModel(apiKey, model, {
        contents: [{ role: 'user', parts }],
        generationConfig: { ...base, thinkingConfig: { thinkingLevel: 'low' } },
      });
    } catch (err) {
      if (!(err instanceof GeminiError && err.status === 400 && /thinking/i.test(err.message))) throw err;
      data = await callModel(apiKey, model, { contents: [{ role: 'user', parts }], generationConfig: base });
    }
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new GeminiError(`${model}: la respuesta no fue JSON válido`, 502);
    }
  });
}

export async function generateImage(
  apiKey: string,
  parts: GeminiPart[],
  aspectRatio: '1:1' | '16:9' | '4:3' | '3:4' | '9:16' = '1:1'
): Promise<string> {
  return withFallback(IMAGE_MODELS, async (model) => {
    const contents = [{ role: 'user', parts }];
    let data;
    try {
      data = await callModel(apiKey, model, {
        contents,
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio } },
      });
    } catch (err) {
      // Older image models reject imageConfig; retry without it.
      if (err instanceof GeminiError && err.status === 400) {
        data = await callModel(apiKey, model, {
          contents,
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        });
      } else {
        throw err;
      }
    }
    const outParts: any[] = data?.candidates?.[0]?.content?.parts || [];
    const img = outParts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const inline = img?.inlineData || img?.inline_data;
    if (!inline) {
      const reason = data?.candidates?.[0]?.finishReason || 'sin imagen en la respuesta';
      throw new GeminiError(`${model}: ${reason}`, 502);
    }
    return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`;
  });
}
