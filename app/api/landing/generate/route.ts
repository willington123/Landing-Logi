import { NextRequest, NextResponse } from 'next/server';
import { generateJSON, imagePart, resolveApiKey, GeminiError, GeminiPart } from '@/lib/gemini';
import { ICON_NAMES, GeneratedCopy } from '@/lib/landing-ai';
import { ClaudeLandingError, claudeLandingAvailable, writeLandingWithClaude } from '@/lib/server/landing-claude';
import { currentOrgId } from '@/lib/server/tenant';
import { cloudEnabled } from '@/lib/server/db';

// Gemini can be slow when saturated; Vercel allows up to 300 s with Fluid compute.
export const maxDuration = 300;

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

const SECTION_KINDS = ['hero', 'offer', 'problem', 'benefits', 'features', 'how_to', 'comparison', 'testimonials', 'guarantee', 'shipping', 'cta'];
// "Secciones de imagen": the same page data plus an art concept and the designed sections Nano Banana will draw.
const SECTIONS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ...SCHEMA.properties,
    concept: { type: 'OBJECT', properties: { name: S, artDirection: S }, required: ['name', 'artDirection'] },
    sections: {
      type: 'ARRAY',
      minItems: 6,
      maxItems: 8,
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: SECTION_KINDS },
          alt: S,
          prompt: S,
          aspect: { type: 'STRING', enum: ['3:4', '1:1', '9:16', '4:3'] },
          useReviewImages: { type: 'BOOLEAN' },
        },
        required: ['kind', 'alt', 'prompt', 'aspect', 'useReviewImages'],
      },
    },
  },
};
(SECTIONS_SCHEMA as any).required = Object.keys(SECTIONS_SCHEMA.properties);

function sectionsBrief(b: any): string {
  const reviews = String(b.reviews || '').trim();
  const reviewImages = Number(b.reviewImagesCount) || 0;
  return `

=== MODO "SECCIONES DE IMAGEN" (además de los campos anteriores) ===
Eres también el DIRECTOR DE ARTE. La landing se mostrará como una columna de 6 a 8 piezas gráficas verticales (estilo landing de e-commerce latinoamericano de alto impacto: tipografía enorme y gruesa, insignias, cintas de precio, íconos en círculos, fondos con textura o degradados, el producto protagonista con luz y sombras reales, hojas/ingredientes/elementos flotando cuando tenga sentido). Nano Banana Pro dibujará cada pieza a partir de tu instrucción y de la foto real del producto.

concept:
- name: nombre corto del concepto visual (ej. "Bosque nocturno con neón lima").
- artDirection: en INGLÉS, la dirección de arte común a TODAS las secciones: paleta exacta en HEX (usa los colores de design), tipografías (describe estilo: condensada, redondeada, serif elegante, script…), tratamiento de fondos, estilo de íconos, luz, mood. Debe ser ÚNICA para este producto: inventa un concepto que nazca del producto, su público y sus colores. Nunca un estilo genérico ni el mismo de siempre: varía composición, fondos y tipografía de verdad.

sections (6 a 8, en orden de venta; el formulario de pedido con precios va DESPUÉS en la página, en texto real):
- Empieza con "hero" (promesa + producto protagonista) y termina con "cta".
- Elige el resto según el producto entre: offer, problem, benefits, features, how_to, comparison, guarantee, shipping${reviews ? ', testimonials' : ''}. No repitas tipos salvo benefits/features.
- aspect: "3:4" casi siempre (móvil); "1:1" para secciones cortas; "9:16" solo para el hero si quieres algo muy alto.
- alt: en español, lo que dice la sección en una frase.
- prompt: en INGLÉS, instrucción completa para Nano Banana: composición (qué va arriba, al centro, abajo), dónde está el producto (idéntico a la foto de referencia), elementos gráficos, fondo, y TODOS los textos en ESPAÑOL que deben aparecer, cada uno entre comillas dobles y escritos EXACTAMENTE como deben salir (con tildes). Máximo 25 palabras de texto visible por sección, frases cortas. Repite en cada prompt la paleta y la tipografía del concepto para que todas las piezas se vean de la misma marca. Pide "no other text, no watermarks, no fake logos".
- Precios: solo los de las ofertas del vendedor, escritos exactamente (formato $129.900). Si no hay descuento real, no muestres "precio antes".
- useReviewImages: true solo en la sección testimonials cuando haya capturas del vendedor; en las demás, false.

HONESTIDAD (obligatorio, también dentro de las imágenes):
- Nada de testimonios, nombres de clientes, caras de "clientes", calificaciones ni cantidades de clientes inventadas.${
    reviews
      ? `
- Hay reseñas REALES del vendedor; si haces la sección testimonials usa SOLO estas, con su texto y nombre tal cual (puedes acortar sin cambiar el sentido), con avatares de iniciales, no caras:
${reviews.slice(0, 2000)}`
      : `
- El vendedor no dio reseñas: NO hagas sección testimonials.`
  }${reviewImages ? `
- El vendedor subió ${reviewImages} captura(s) reales de clientes: en testimonials pide colocarlas como tarjetas o fotos enmarcadas, sin alterarlas.` : ''}
- Nada de "antes/después", cuerpos transformados ni resultados garantizados. Personas solo como modelos usando el producto, sin prometer resultados.
- Nada de promesas médicas, de adelgazar ni de curar. Nada de "stock limitado" o "últimas unidades" inventados.`;
}

// Lists keep the exact number of items the page layout expects (structured outputs can't enforce counts).
function fitCounts(value: any, schema: any): any {
  if (!schema || value == null) return value;
  if (schema.type === 'ARRAY' && Array.isArray(value)) {
    const items = value.map((v) => fitCounts(v, schema.items));
    return typeof schema.maxItems === 'number' ? items.slice(0, schema.maxItems) : items;
  }
  if (schema.type === 'OBJECT' && typeof value === 'object') {
    const out: any = { ...value };
    for (const [k, sub] of Object.entries(schema.properties || {})) out[k] = fitCounts(out[k], sub);
    return out;
  }
  return value;
}

// Enforced here too: no testimonials section unless the seller gave real reviews; review images only there.
function cleanSections(copy: any, b: any) {
  if (!Array.isArray(copy?.sections)) return copy;
  const hasReviews = Boolean(String(b.reviews || '').trim()) || Number(b.reviewImagesCount) > 0;
  const sections = copy.sections
    .filter((x: any) => x && SECTION_KINDS.includes(x.kind) && typeof x.prompt === 'string' && x.prompt.trim())
    .filter((x: any) => hasReviews || x.kind !== 'testimonials')
    .map((x: any) => ({ ...x, useReviewImages: x.kind === 'testimonials' && Number(b.reviewImagesCount) > 0 }));
  return { ...copy, sections };
}

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
  let claudeNote: string | null = null;
  try {
    const body = await req.json();
    if (!body.imageBase64) {
      return NextResponse.json({ success: false, error: 'Sube una foto del producto.' }, { status: 400 });
    }
    const sectionsMode = body.mode === 'sections';
    const schema = sectionsMode ? SECTIONS_SCHEMA : SCHEMA;
    const prompt = buildPrompt(body) + (sectionsMode ? sectionsBrief(body) : '');

    // 1) Claude writes the page (copy, design and image prompts) when the store has it.
    const orgId = cloudEnabled() ? await currentOrgId().catch(() => null) : null;
    if (body.writer !== 'gemini') {
      try {
        const { copy, model } = await writeLandingWithClaude({ orgId, prompt, images: [body.imageBase64, ...(body.extraImages || []).slice(0, 2)], schema });
        return NextResponse.json({ success: true, copy: cleanSections(fitCounts(copy, schema), body), writer: 'claude', model });
      } catch (e) {
        claudeNote = e instanceof ClaudeLandingError ? e.message : String((e as Error)?.message || e);
        console.error('Landing con Claude', claudeNote);
      }
    }

    // 2) Gemini as the fallback writer.
    const apiKey = resolveApiKey(body.geminiApiKey);
    const parts: GeminiPart[] = [{ text: prompt }, imagePart(body.imageBase64)];
    for (const extra of (body.extraImages || []).slice(0, 2)) {
      try {
        parts.push(imagePart(extra));
      } catch {
        // ignore invalid extra images
      }
    }

    const copy = await generateJSON<GeneratedCopy>(apiKey, parts, schema);
    return NextResponse.json({ success: true, copy: cleanSections(copy, body), writer: 'gemini', claudeNote });
  } catch (err) {
    const status = err instanceof GeminiError ? err.status : 500;
    const raw = err instanceof Error ? err.message : 'Error interno';
    let message = raw;
    if (/^Falta la API Key/.test(raw)) message = raw;
    else if (/api key/i.test(raw)) message = 'Google rechazó la API Key. Revisa que esté bien copiada.';
    else if (status === 429)
      message = /per day/i.test(raw)
        ? 'Tu clave gratuita de Gemini agotó su límite diario en todos los modelos. Se renueva mañana, o activa la facturación para quitar el límite.'
        : 'Límite de uso de tu clave de Gemini alcanzado. Espera un minuto y vuelve a intentarlo.';
    else if (status >= 500) message = 'Google está saturado en este momento. Inténtalo de nuevo en unos minutos.';
    if (claudeNote) message = `Claude no pudo escribir la página (${claudeNote}) y Gemini tampoco: ${message}`;
    return NextResponse.json({ success: false, error: message, rawError: raw }, { status: status >= 400 ? status : 500 });
  }
}

// Lets the UI know whether a server-side Gemini key exists (hides the key field) and whether Claude writes the page.
export async function GET() {
  const orgId = cloudEnabled() ? await currentOrgId().catch(() => null) : null;
  return NextResponse.json({ serverKey: Boolean(process.env.GEMINI_API_KEY), claude: await claudeLandingAvailable(orgId) });
}
