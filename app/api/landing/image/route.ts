import { NextRequest, NextResponse } from 'next/server';
import { generateImage, imagePart, resolveApiKey, GeminiError } from '@/lib/gemini';

export const maxDuration = 60;

const ASPECTS = ['1:1', '16:9', '4:3', '3:4', '9:16'] as const;

// Generates one ad scene that keeps the real product from the reference photo.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = resolveApiKey(body.geminiApiKey);
    const scene = String(body.prompt || '').slice(0, 1500);
    if (!body.imageBase64 || !scene) {
      return NextResponse.json({ success: false, error: 'Faltan la foto o la descripción de la escena.' }, { status: 400 });
    }
    const aspect = ASPECTS.includes(body.aspectRatio) ? body.aspectRatio : '1:1';

    const prompt = `Create a high-end commercial advertising photograph.
Use the EXACT product shown in the reference image as the hero: keep its shape, proportions, colors, materials, buttons, labels and logo identical. Do not redesign or replace it.
Scene: ${scene}
Style: photorealistic, premium e-commerce ad, sharp focus on the product, natural shadows and reflections, rich but realistic colors${body.palette ? `, color mood that matches ${body.palette}` : ''}.
Do NOT add any text, captions, prices, watermarks or extra logos.`;

    const image = await generateImage(apiKey, [imagePart(body.imageBase64), { text: prompt }], aspect);
    return NextResponse.json({ success: true, image });
  } catch (err) {
    const status = err instanceof GeminiError ? err.status : 500;
    const raw = err instanceof Error ? err.message : 'Error interno';
    // Free-tier keys have a quota of 0 for image models: tell the user plainly.
    if (status === 429 && /limit: 0/.test(raw)) {
      return NextResponse.json(
        {
          success: false,
          code: 'no_image_quota',
          error:
            'Tu clave de Gemini es del plan gratuito, que no incluye generar imágenes. Activa la facturación en Google AI Studio para usarlas.',
          rawError: raw,
        },
        { status: 429 }
      );
    }
    let message = raw;
    if (status === 429) message = 'Límite de uso por minuto alcanzado. Espera un minuto y vuelve a intentarlo.';
    else if (status >= 500) message = 'Google está saturado en este momento. Inténtalo de nuevo en unos minutos.';
    return NextResponse.json({ success: false, error: message, rawError: raw }, { status: status >= 400 ? status : 500 });
  }
}
