import { NextRequest, NextResponse } from 'next/server';
import { generateImage, imagePart, GeminiError } from '@/lib/gemini';
import { cloudflareConfigured, generateImageCloudflare } from '@/lib/cloudflare';

export const maxDuration = 60;

const ASPECTS = ['1:1', '16:9', '4:3', '3:4', '9:16'] as const;

// IMAGE_PROVIDER: "auto" (default) tries Gemini and falls back to Cloudflare,
// "gemini" or "cloudflare" force one provider.
const PROVIDER = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase();

function geminiKey(clientKey?: string) {
  return (process.env.GEMINI_API_KEY || clientKey || '').trim();
}

function buildPrompt(scene: string, palette: string | undefined, refName: string) {
  return `Create a high-end commercial advertising photograph.
Use the EXACT product shown in ${refName} as the hero: keep its shape, proportions, colors, materials, buttons, labels and logo identical. Do not redesign or replace it.
Scene: ${scene}
Style: photorealistic, premium e-commerce ad, sharp focus on the product, natural shadows and reflections, rich but realistic colors${palette ? `, color mood that matches ${palette}` : ''}.
Do NOT add any text, captions, prices, watermarks or extra logos.`;
}

// Generates one ad scene that keeps the real product from the reference photo.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scene = String(body.prompt || '').slice(0, 1500);
    if (!body.imageBase64 || !scene) {
      return NextResponse.json({ success: false, error: 'Faltan la foto o la descripción de la escena.' }, { status: 400 });
    }
    const aspect = ASPECTS.includes(body.aspectRatio) ? body.aspectRatio : '1:1';
    const key = geminiKey(body.geminiApiKey);
    const canGemini = PROVIDER !== 'cloudflare' && Boolean(key);
    const canCloudflare = PROVIDER !== 'gemini' && cloudflareConfigured();

    if (!canGemini && !canCloudflare) {
      return NextResponse.json(
        { success: false, code: 'no_image_quota', error: 'No hay ningún proveedor de imágenes configurado.' },
        { status: 400 }
      );
    }

    let geminiFailure: unknown = null;
    if (canGemini) {
      try {
        const image = await generateImage(
          key,
          [imagePart(body.imageBase64), { text: buildPrompt(scene, body.palette, 'the reference image') }],
          aspect
        );
        return NextResponse.json({ success: true, image, provider: 'gemini' });
      } catch (err) {
        geminiFailure = err;
        if (!canCloudflare) throw err;
      }
    }

    // Cloudflare needs a reference smaller than 512x512; the browser sends one in referenceImage.
    const image = await generateImageCloudflare(
      buildPrompt(scene, body.palette, 'image 0'),
      body.referenceImage,
      aspect
    );
    return NextResponse.json({
      success: true,
      image,
      provider: 'cloudflare',
      ...(geminiFailure ? { note: 'Gemini no pudo generar la imagen; se usó Cloudflare.' } : {}),
    });
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
            'Tu clave de Gemini es del plan gratuito, que no incluye generar imágenes. Activa la facturación en Google AI Studio o configura Cloudflare (gratis).',
          rawError: raw,
        },
        { status: 429 }
      );
    }
    let message = raw;
    if (status === 429) message = 'Límite de uso alcanzado. Espera un poco y vuelve a intentarlo.';
    else if (status === 401 || status === 403) message = `Credenciales rechazadas: ${raw}`;
    else if (status >= 500) message = 'El proveedor de imágenes está saturado. Inténtalo de nuevo en unos minutos.';
    return NextResponse.json({ success: false, error: message, rawError: raw }, { status: status >= 400 ? status : 500 });
  }
}
