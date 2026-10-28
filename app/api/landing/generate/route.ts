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
    featureChips: objArr(4, { icon, text: S }),
    painTags: strArr(2),
    productDetails: S,
    shippingInfo: S,
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

function offersText(b: any): string {
  const offers = (Array.isArray(b.offers) ? b.offers : []).filter((o: any) => o.units > 0 && o.price > 0);
  if (!offers.length) return `1 unidad por ${b.promoPrice} ${b.currency}`;
  const list = offers.map((o: any) => `${o.units} ${o.units === 1 ? 'unidad' : 'unidades'} por ${o.price} ${b.currency}`).join('; ');
  const min = Math.min(...offers.map((o: any) => o.units));
  return min > 1 ? `${list}. Compra mínima: ${min} unidades.` : list;
}

function buildPrompt(b: any): string {
  return `Eres el director creativo de una marca DTC premium (estilo de las mejores tiendas Shopify) y vendes con pago contraentrega en ${b.country || 'Colombia'}.
Analiza la FOTO del producto y los DATOS del vendedor y escribe la ficha de producto completa para ESTE producto (nada genérico que sirva para cualquier otro).

Año actual: ${new Date().getFullYear()} (si mencionas un año, usa este).

DATOS DEL VENDEDOR
- Nombre: ${b.productName || '(dedúcelo de la foto)'}
- Descripción / notas: ${b.description || '(ninguna, dedúcelo de la foto)'}
- Público objetivo: ${b.audience || '(dedúcelo)'}
- Marca / tienda: ${b.brandName || '(no indicada; no inventes un nombre de marca, habla del producto)'}
- Ofertas del vendedor (son las ÚNICAS que existen): ${offersText(b)}
- Envío: ${b.shippingType === 'calculated' ? 'con costo según destino' : 'gratis'} · Pago contraentrega
- Garantía: ${b.guaranteeDays || 30} días
- Tono deseado: ${b.tone || 'cercano, seguro y sensorial'}

ESTILO DE ESCRITURA (muy importante)
- Voz de marca premium: calmada, segura, sensorial y concreta. Describe cómo se siente usar el producto y el resultado en el día a día.
- NADA de mayúsculas sostenidas, ni "¡OFERTA FLASH!", ni más de un signo de exclamación en toda la página.
- Frases cortas. Español neutro latinoamericano.
- En títulos de sección y en el headline marca UNA palabra clave con **dobles asteriscos** (ej. "Tu piel, **más luminosa** cada mañana"). En textos descriptivos puedes marcar 1-2 frases clave con **.

CAMPOS
- productName: nombre comercial del producto (máx. 6 palabras).
- eyebrow: frase corta tipo etiqueta que resume la promesa (máx. 5 palabras, sin mayúsculas sostenidas).
- headline: promesa principal (máx. 10 palabras). subheadline: 1-2 frases con el beneficio central y el pago contraentrega.
- featureChips: 4 ventajas muy cortas (2-4 palabras) con icono.
- painTitle: pregunta que conecta con el problema. painTags: 2 problemas en 1-3 palabras (se muestran como etiquetas sobre una imagen). painPoints: 3 problemas concretos.
- solutionTitle / solutionText: cómo el producto resuelve esos problemas (2-3 frases sensoriales).
- benefits: 4 beneficios (título corto + 1 frase) para mostrar alrededor del producto.
- benefitBlocks: 3 bloques con título, 2-3 frases y 3 bullets cortos.
- howItWorks: 3 pasos de uso o de cómo notarás el cambio (título corto + 1 frase).
- comparison: 5 filas frente a "alternativas comunes" (sin nombrar marcas); "us" y "others" muy cortos.
- productDetails: 2-3 frases con qué incluye, materiales o especificaciones (solo lo que se ve o dio el vendedor).
- shippingInfo: 1-2 frases sobre envío y pago contraentrega.
- stats: 3 datos de la oferta o del producto (ej. "${b.guaranteeDays || 30} días" de garantía, "24-48 h" de entrega). NUNCA cifras de clientes.
- ctaText: máx. 4 palabras (ej. "Lo quiero", "Pedir el mío").
- urgencyText: mensaje breve para la barra superior sobre envío/pago (sin urgencia falsa).

REGLAS
- Usa SOLO características visibles en la foto o dadas por el vendedor. No inventes certificaciones, cifras técnicas, premios ni promesas médicas.
- NO inventes ofertas, descuentos, combos, 2x1, regalos ni cantidades distintas a las del vendedor. Si hay compra mínima, menciónala con naturalidad.
- NO inventes testimonios, número de clientes, calificaciones, porcentajes de satisfacción ni apariciones en prensa.
- FAQs: dudas reales de compra (uso, envío, pago contraentrega, garantía, para quién es).

DISEÑO
- design: paleta HEX tipo marca DTC, cálida y luminosa, inspirada en los colores reales del producto. "primary": color del botón principal (puede ser vivo, p. ej. amarillo, rosa, verde, coral). "accent": color secundario para detalles. "light": fondo pastel muy suave que combine (casi blanco con un toque de color). "dark": color de texto/sección oscura (no negro puro).
- vibe: el estilo que mejor encaja con el producto.

PROMPTS DE IMAGEN (en INGLÉS, se usarán con la foto del producto como referencia)
- heroImagePrompt: foto de producto tipo marca premium, el producto sobre una superficie o escena que combine con la paleta, luz natural suave.
- solutionImagePrompt: una persona del público objetivo usando el producto en un momento cotidiano, foto lifestyle realista y cálida.
- benefitBlocks[].imagePrompt: una escena distinta por beneficio que lo demuestre (detalle macro, uso, resultado).
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
    else if (status === 429)
      message = /per day/i.test(raw)
        ? 'Tu clave gratuita de Gemini agotó su límite diario en todos los modelos. Se renueva mañana, o activa la facturación para quitar el límite.'
        : 'Límite de uso de tu clave de Gemini alcanzado. Espera un minuto y vuelve a intentarlo.';
    else if (status >= 500) message = 'Google está saturado en este momento. Inténtalo de nuevo en unos minutos.';
    return NextResponse.json({ success: false, error: message, rawError: raw }, { status: status >= 400 ? status : 500 });
  }
}

// Lets the UI know whether a server-side key exists, so it can hide the key field.
export async function GET() {
  return NextResponse.json({ serverKey: Boolean(process.env.GEMINI_API_KEY) });
}
