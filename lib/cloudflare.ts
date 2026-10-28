// Server-side helper for Cloudflare Workers AI image generation (free daily allowance).
// Model: FLUX.2 [klein] 4B, which can use the product photo as a reference image.

// Tried in order. klein-4b is the cheapest (~79 free images/day) but sometimes hangs on
// Cloudflare's side, so it gets a short timeout before falling back to klein-9b
// (reliable, but ~6 free images/day).
const MODELS = [
  process.env.CLOUDFLARE_IMAGE_MODEL,
  '@cf/black-forest-labs/flux-2-klein-4b',
  '@cf/black-forest-labs/flux-2-klein-9b',
].filter((m, i, a): m is string => Boolean(m) && a.indexOf(m) === i);
const TIMEOUT_MS = 25000;

export class CloudflareError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function cloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim());
}

// Output sizes per aspect ratio (multiples of 16, within the model's 256–1920 range).
const SIZES: Record<string, [number, number]> = {
  '16:9': [1280, 720],
  '4:3': [1024, 768],
  '3:4': [768, 1024],
  '9:16': [720, 1280],
  '1:1': [1024, 1024],
};

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) throw new CloudflareError('La imagen de referencia debe ser una data URL en base64.', 400);
  return new Blob([Buffer.from(match[2], 'base64')], { type: match[1] });
}

/**
 * Generates one image. `referenceImage` must be smaller than 512x512 (a model limit);
 * the browser prepares that small copy before calling the API.
 */
export async function generateImageCloudflare(
  prompt: string,
  referenceImage: string | undefined,
  aspectRatio: string
): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN!.trim();
  const [width, height] = SIZES[aspectRatio] || SIZES['1:1'];

  const errors: CloudflareError[] = [];
  for (const model of MODELS) {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('width', String(width));
    form.append('height', String(height));
    if (referenceImage) form.append('input_image_0', dataUrlToBlob(referenceImage), 'product.jpg');

    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        const msg = data?.errors?.[0]?.message || data?.error || `HTTP ${res.status}`;
        throw new CloudflareError(`${model}: ${msg}`, res.status >= 400 ? res.status : 502);
      }
      const b64: string | undefined = data?.result?.image || data?.image;
      if (!b64) throw new CloudflareError(`${model}: no devolvió ninguna imagen`, 502);
      return toDataUrl(b64);
    } catch (err) {
      const e =
        err instanceof CloudflareError
          ? err
          : new CloudflareError(
              `${model}: ${err instanceof Error && err.name === 'TimeoutError' ? 'no respondió a tiempo' : String(err)}`,
              504
            );
      errors.push(e);
      // Bad token / account or daily limit: other models won't help.
      if (e.status === 401 || e.status === 403 || e.status === 429) break;
    }
  }
  const first = errors[0] || new CloudflareError('Error desconocido de Cloudflare');
  throw new CloudflareError(`Cloudflare: ${errors.map((e) => e.message).join(' | ')}`, first.status);
}

function toDataUrl(b64: string): string {
  if (b64.startsWith('data:')) return b64;
  // Detect the format from the first bytes (the API doesn't state it).
  const mime = b64.startsWith('iVBOR') ? 'image/png' : b64.startsWith('UklGR') ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${b64}`;
}
