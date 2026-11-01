import { NextRequest, NextResponse } from 'next/server';
import { generateImage, imagePart, GeminiError } from '@/lib/gemini';
import { cloudflareConfigured, generateImageCloudflare } from '@/lib/cloudflare';
import { replicateConfigured, generateImageReplicate } from '@/lib/replicate';

export const maxDuration = 120;

const ASPECTS = ['1:1', '16:9', '4:3', '3:4', '9:16'] as const;
type Provider = 'gemini' | 'replicate' | 'cloudflare';

// IMAGE_PROVIDER: "auto" (default) tries Gemini → Replicate → Cloudflare, skipping the ones
// not configured. Or force one: "gemini", "replicate" or "cloudflare".
const PROVIDER = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase();

function buildPrompt(scene: string, palette: string | undefined, refName: string) {
  return `Create a high-end commercial advertising photograph.
Use the EXACT product shown in ${refName} as the hero: keep its shape, proportions, colors, materials, buttons, labels and logo identical. Do not redesign or replace it.
Scene: ${scene}
Style: photorealistic, premium e-commerce ad, sharp focus on the product, natural shadows and reflections, rich but realistic colors${palette ? `, color mood that matches ${palette}` : ''}.
Do NOT add any text, captions, prices, watermarks or extra logos.`;
}

// "design" mode: Claude already wrote the full art direction; this asks for a finished graphic section.
function buildDesignPrompt(prompt: string, artDirection: string | undefined, extraRefs: number) {
  return `Design ONE finished, high-impact vertical section of a mobile e-commerce landing page (a single graphic panel, edge to edge, no phone frame, no browser UI).
The FIRST reference image is the real product: show it IDENTICAL (shape, colors, label, logo). Never redesign it or invent another package.${
    extraRefs ? `\nThe next ${extraRefs} reference image(s) are REAL customer screenshots: place them inside the design as framed cards, unaltered and legible.` : ''
  }
${artDirection ? `Art direction for the whole page: ${artDirection}\n` : ''}Section: ${prompt}
Typography must be bold, perfectly legible and spelled EXACTLY as quoted (Spanish, with accents). Render only the quoted texts; no other text, no watermarks, no fake logos, no fake ratings, no fake customer faces.`;
}

// Data URLs over ~1.5 MB are slow to send; fall back to the small reference copy.
function pickReference(full: string, small?: string) {
  return full.length < 1_500_000 || !small ? full : small;
}

// Generates one ad scene that keeps the real product from the reference photo.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const design = body.mode === 'design';
    const scene = String(body.prompt || '').slice(0, design ? 3000 : 1500);
    const extraRefs: string[] = design && Array.isArray(body.extraImages) ? body.extraImages.filter((x: unknown) => typeof x === 'string').slice(0, 4) : [];
    if (!body.imageBase64 || !scene) {
      return NextResponse.json({ success: false, error: 'Faltan la foto o la descripción de la escena.' }, { status: 400 });
    }
    const aspect = ASPECTS.includes(body.aspectRatio) ? body.aspectRatio : '1:1';
    const geminiKey = (process.env.GEMINI_API_KEY || body.geminiApiKey || '').trim();

    const available: Record<Provider, boolean> = {
      gemini: Boolean(geminiKey),
      replicate: replicateConfigured(),
      cloudflare: cloudflareConfigured(),
    };
    const order: Provider[] =
      PROVIDER === 'auto' ? (['gemini', 'replicate', 'cloudflare'] as Provider[]) : ([PROVIDER] as Provider[]);
    const chain = order.filter((p) => available[p]);

    if (!chain.length) {
      return NextResponse.json(
        {
          success: false,
          code: 'no_image_quota',
          error:
            PROVIDER === 'auto'
              ? 'No hay ningún proveedor de imágenes configurado.'
              : `El proveedor "${PROVIDER}" no está configurado en .env.local.`,
        },
        { status: 400 }
      );
    }

    const designText = design ? buildDesignPrompt(scene, String(body.artDirection || '').slice(0, 1500) || undefined, extraRefs.length) : '';
    const run: Record<Provider, () => Promise<string>> = {
      gemini: () =>
        design
          ? generateImage(geminiKey, [imagePart(body.imageBase64), ...extraRefs.map((x) => imagePart(x)), { text: designText }], aspect, { preferPro: true })
          : generateImage(geminiKey, [imagePart(body.imageBase64), { text: buildPrompt(scene, body.palette, 'the reference image') }], aspect),
      replicate: () =>
        generateImageReplicate(design ? designText : buildPrompt(scene, body.palette, 'the reference image'), [pickReference(body.imageBase64, body.referenceImage)], aspect),
      // Cloudflare needs a reference smaller than 512x512; the browser sends one in referenceImage.
      cloudflare: () => generateImageCloudflare(design ? designText : buildPrompt(scene, body.palette, 'image 0'), body.referenceImage, aspect),
    };

    const failures: { provider: Provider; err: unknown }[] = [];
    for (const provider of chain) {
      try {
        const image = await run[provider]();
        return NextResponse.json({
          success: true,
          image,
          provider,
          ...(failures.length ? { note: `Falló ${failures.map((f) => f.provider).join(', ')}; se usó ${provider}.` } : {}),
        });
      } catch (err) {
        failures.push({ provider, err });
      }
    }
    throw failures[0].err;
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    const raw = err instanceof Error ? err.message : 'Error interno';
    // Free-tier Gemini keys have a quota of 0 for image models: tell the user plainly.
    if (err instanceof GeminiError && status === 429 && /limit: 0/.test(raw)) {
      return NextResponse.json(
        {
          success: false,
          code: 'no_image_quota',
          error:
            'Tu clave de Gemini es del plan gratuito, que no incluye generar imágenes. Activa la facturación en Google AI Studio o configura Replicate o Cloudflare.',
          rawError: raw,
        },
        { status: 429 }
      );
    }
    let message = raw;
    if (status === 402) message = 'Sin saldo en el proveedor de imágenes. Añade crédito o un método de pago.';
    else if (status === 429) message = 'Límite de uso alcanzado. Espera un poco y vuelve a intentarlo.';
    else if (status === 401 || status === 403) message = `Credenciales rechazadas: ${raw}`;
    else if (status >= 500) message = 'El proveedor de imágenes está saturado. Inténtalo de nuevo en unos minutos.';
    return NextResponse.json({ success: false, error: message, rawError: raw }, { status: status >= 400 ? status : 500 });
  }
}
