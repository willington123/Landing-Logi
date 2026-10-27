import { NextRequest, NextResponse } from 'next/server';
import { generateJSON, imagePart, resolveApiKey, GeminiError, GeminiPart } from '@/lib/gemini';
import { ICON_NAMES, GeneratedCopy } from '@/lib/landing-ai';

export const maxDuration = 60;

const S = { type: 'STRING' } as const;
const strArr = (n: number) => ({ type: 'ARRAY', items: S, minItems: n, maxItems: n });
const objArr = (n: number, properties: Record<string, unknown>) => ({
  type: 'ARRAY',
  minItems: n,
  maxItems: n,
  items: { type: 'OBJECT', properties, required: Object.keys(properties) },
});
const icon = { type: 'STRING', enum: [...ICON_NAMES] };

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    productName: S,
    category: S,
    eyebrow: S,
    headline: S,
    subheadline: S,
    heroBullets: strArr(3),
    ctaText: S,
    discountBadge: S,
    urgencyText: S,
    painTitle: S,
    painPoints: objArr(3, { icon, title: S, text: S }),
    solutionTitle: S,
    solutionText: S,
    benefits: objArr(4, { icon, title: S, description: S }),
    benefitBlocks: objArr(3, { title: S, text: S, bullets: strArr(3), imagePrompt: S }),
    stats: objArr(3, { value: S, label: S }),
    howItWorksTitle: S,
    howItWorks: objArr(3, { title: S, text: S }),
    comparisonTitle: S,
    comparison: objArr(5, { feature: S, us: S, others: S }),
    faqs: objArr(5, { question: S, answer: S }),
    guaranteeText: S,
    finalCtaTitle: S,
    finalCtaText: S,
    seoTitle: S,
    seoDescription: S,
    design: {
      type: 'OBJECT',
      properties: {
        primary: S,
        accent: S,
        dark: S,
        light: S,
        vibe: { type: 'STRING', enum: ['bold', 'luxury', 'fresh', 'tech', 'warm'] },
      },
      required: ['primary', 'accent', 'dark', 'light', 'vibe'],
    },
    heroImagePrompt: S,
    solutionImagePrompt: S,
  },
};
(SCHEMA as any).required = Object.keys(SCHEMA.properties);

function buildPrompt(b: any): string {
  return `Eres un copywriter experto en respuesta directa y un director de arte para e-commerce con pago contraentrega en ${b.country || 'Colombia'}.
Analiza la FOTO del producto y los DATOS del vendedor, y escribe una landing page de ventas larga, específica y muy persuasiva para ESTE producto (nada genérico que sirva para cualquier producto).

Año actual: ${new Date().getFullYear()} (si mencionas un año, usa este).

DATOS DEL VENDEDOR
- Nombre: ${b.productName || '(dedúcelo de la foto)'}
- Descripción / notas: ${b.description || '(ninguna, dedúcelo de la foto)'}
- Público objetivo: ${b.audience || '(dedúcelo)'}
- Precio normal: ${b.regularPrice} ${b.currency} · Precio oferta: ${b.promoPrice} ${b.currency}
- Envío: ${b.shippingType === 'calculated' ? 'con costo según destino' : 'gratis'} · Pago contraentrega
- Garantía: ${b.guaranteeDays || 30} días
- Tono deseado: ${b.tone || 'persuasivo, cercano y directo'}

REGLAS DE COPY
- Español neutro latinoamericano, frases cortas, con fuerza. Titular de máximo 12 palabras centrado en el resultado que obtiene el cliente.
- Dolores reales y concretos del público; la solución conecta cada dolor con una característica del producto.
- Usa SOLO características visibles en la foto o dadas por el vendedor. No inventes certificaciones, cifras técnicas, premios ni promesas médicas.
- NO inventes testimonios, número de clientes, calificaciones ni ventas. Las "stats" deben ser datos del producto u oferta (ej. "${b.guaranteeDays || 30} días" de garantía, "24-48 h" de entrega, "0 $" por adelantado), nunca cifras de clientes.
- La comparación es frente a "alternativas comunes" de forma genérica, sin nombrar marcas.
- FAQs sobre dudas reales de compra: uso, envío, pago contraentrega, garantía, para quién es.
- ctaText: verbo de acción, máximo 5 palabras (ej. "Quiero el mío ahora").

REGLAS DE DISEÑO
- design: paleta HEX que combine con los colores reales del producto y su categoría, con alto contraste. "primary" debe verse bien como botón con texto blanco; "dark" es un fondo muy oscuro; "light" un fondo muy claro y suave.

PROMPTS DE IMAGEN (en INGLÉS, se usarán con la foto del producto como referencia)
- heroImagePrompt: escena publicitaria horizontal y aspiracional con el producto como protagonista en su contexto de uso ideal, iluminación cinematográfica, fondo que combine con la paleta.
- solutionImagePrompt: una persona del público objetivo usando el producto y disfrutando el resultado, foto lifestyle realista.
- benefitBlocks[].imagePrompt: una escena distinta por beneficio que lo demuestre visualmente (detalle macro, uso, resultado).
- Nunca pidas texto, logos nuevos ni marcas de agua dentro de la imagen.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = resolveApiKey(body.geminiApiKey);
    if (!body.imageBase64) {
      return NextResponse.json({ success: false, error: 'Sube una foto del producto.' }, { status: 400 });
    }

    const parts: GeminiPart[] = [{ text: buildPrompt(body) }, imagePart(body.imageBase64)];
    for (const extra of (body.extraImages || []).slice(0, 2)) {
      try {
        parts.push(imagePart(extra));
      } catch {
        // ignore invalid extra images
      }
    }

    const copy = await generateJSON<GeneratedCopy>(apiKey, parts, SCHEMA);
    return NextResponse.json({ success: true, copy });
  } catch (err) {
    const status = err instanceof GeminiError ? err.status : 500;
    const raw = err instanceof Error ? err.message : 'Error interno';
    let message = raw;
    if (/api key/i.test(raw)) message = 'Google rechazó la API Key. Revisa que esté bien copiada.';
    else if (status === 429) message = 'Límite de uso de tu clave de Gemini alcanzado. Espera un minuto y vuelve a intentarlo.';
    else if (status >= 500) message = 'Google está saturado en este momento. Inténtalo de nuevo en unos minutos.';
    return NextResponse.json({ success: false, error: message, rawError: raw }, { status: status >= 400 ? status : 500 });
  }
}

// Lets the UI know whether a server-side key exists, so it can hide the key field.
export async function GET() {
  return NextResponse.json({ serverKey: Boolean(process.env.GEMINI_API_KEY) });
}
