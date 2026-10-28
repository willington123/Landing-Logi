// Server-side helper for Replicate (pay per image, billed by Replicate, not Google).
// Default model: google/nano-banana, Google's Gemini image model hosted on Replicate.

const MODEL = process.env.REPLICATE_IMAGE_MODEL || 'google/nano-banana';
const API = 'https://api.replicate.com/v1';
const MAX_WAIT_MS = 90000;

export class ReplicateError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function replicateConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN?.trim());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Accounts with a low balance can only run one prediction at a time; Replicate answers
// 429 with how long to wait, so we wait and retry a few times.
async function call(url: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN!.trim()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429 && attempt < 5) {
    const secs = Number(/(\d+)\s*second/.exec(String(data?.detail || ''))?.[1]) || Number(res.headers.get('retry-after')) || 6;
    await sleep(Math.min(30, secs + 1) * 1000);
    return call(url, init, attempt + 1);
  }
  if (!res.ok) {
    const msg = data?.detail || data?.title || data?.error || `HTTP ${res.status}`;
    throw new ReplicateError(`Replicate (${MODEL}): ${msg}`, res.status);
  }
  return data;
}

// Replicate returns a temporary URL; download it so the landing keeps the image.
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new ReplicateError(`No se pudo descargar la imagen generada (HTTP ${res.status}).`, 502);
  const type = res.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${buf.toString('base64')}`;
}

export async function generateImageReplicate(prompt: string, referenceImages: string[], aspectRatio: string): Promise<string> {
  const input: Record<string, unknown> = { prompt, aspect_ratio: aspectRatio, output_format: 'jpg' };
  if (referenceImages.length) input.image_input = referenceImages;

  // "Prefer: wait" keeps the request open until the image is ready (up to 60 s).
  let prediction = await call(`${API}/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: { Prefer: 'wait=60' },
    body: JSON.stringify({ input }),
  });

  const started = Date.now();
  while (['starting', 'processing'].includes(prediction.status) && Date.now() - started < MAX_WAIT_MS) {
    await sleep(2000);
    prediction = await call(prediction.urls.get);
  }

  if (prediction.status !== 'succeeded') {
    const reason = prediction.error || (prediction.status ? `estado "${prediction.status}"` : 'sin respuesta');
    throw new ReplicateError(`Replicate (${MODEL}): ${reason}`, 502);
  }
  const out = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!out || typeof out !== 'string') throw new ReplicateError('Replicate no devolvió ninguna imagen.', 502);
  return out.startsWith('data:') ? out : urlToDataUrl(out);
}
