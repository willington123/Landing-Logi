// Sample page for each look of "Impacto Premium" (/muestra/[style]): a made-up product ("Vítara") with drawn
// pictures, so the seller sees how the style looks before generating. Nothing here reaches a real page.
import { buildSalesLanding, GeneratedCopy } from './landing-ai';
import type { ImpactStyle, LandingPageConfig } from './types';

interface Pal {
  bg: string; // SVG background (gradient stops)
  bg2: string;
  body: string; // bottle
  label: string;
  labelText: string;
  cap: string;
  glow: string;
  floor: string;
}

const PAL: Record<ImpactStyle, Pal> = {
  impact: { bg: '#3A0A0E', bg2: '#0B0B0F', body: '#141416', label: '#E11D2A', labelText: '#FFFFFF', cap: '#1E1E22', glow: '#E11D2A', floor: '#1A1A1E' },
  blast: { bg: '#D3140F', bg2: '#4A0505', body: '#111111', label: '#E3141C', labelText: '#FFD21A', cap: '#1A1A1A', glow: '#FFD21A', floor: '#2A0606' },
  noir: { bg: '#2A2216', bg2: '#070605', body: '#0E0D0C', label: '#050505', labelText: '#D8B56E', cap: '#1A1714', glow: '#C9A25C', floor: '#1C1813' },
  clinic: { bg: '#FFFFFF', bg2: '#E3EAF2', body: '#1C2633', label: '#FFFFFF', labelText: '#2F4A66', cap: '#26313F', glow: '#9FB6CC', floor: '#D9E1EA' },
  neon: { bg: '#1B1F4A', bg2: '#04070F', body: '#0B1020', label: '#0B1020', labelText: '#22D3EE', cap: '#141A33', glow: '#22D3EE', floor: '#0D1631' },
};

const url = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

function bottle(p: Pal, x: number, y: number, s: number, id: string) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="150" rx="120" ry="16" fill="#000" opacity="0.35"/>
    <rect x="-70" y="-160" width="140" height="44" rx="10" fill="${p.cap}"/>
    <rect x="-70" y="-160" width="140" height="10" rx="5" fill="#fff" opacity="0.08"/>
    <rect x="-98" y="-122" width="196" height="270" rx="36" fill="${p.body}"/>
    <rect x="-98" y="-48" width="196" height="118" fill="${p.label}"/>
    <text x="0" y="-2" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="36" fill="${p.labelText}" letter-spacing="2">VÍTARA</text>
    <text x="0" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="12" fill="${p.labelText}" opacity="0.85" letter-spacing="2">ENERGÍA · VITALIDAD</text>
    <text x="0" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="${p.labelText}" opacity="0.7" letter-spacing="1">60 CÁPSULAS</text>
    <rect x="-86" y="-110" width="26" height="246" rx="13" fill="url(#hl${id})"/>
  </g>`;
}

function defs(p: Pal, id: string, w: number, h: number, style: ImpactStyle) {
  const clinic = style === 'clinic';
  return `<defs>
    <radialGradient id="bg${id}" cx="${clinic ? '50%' : '68%'}" cy="45%" r="75%"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bg2}"/></radialGradient>
    <radialGradient id="gl${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${p.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
    <linearGradient id="hl${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg${id})"/>`;
}

// Style details drawn behind the product.
function decor(style: ImpactStyle, p: Pal, w: number, h: number) {
  if (style === 'blast')
    return Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const cx = w * 0.62, cy = h * 0.48, r = Math.max(w, h);
      return `<polygon points="${cx},${cy} ${cx + Math.cos(a) * r},${cy + Math.sin(a) * r} ${cx + Math.cos(a + 0.16) * r},${cy + Math.sin(a + 0.16) * r}" fill="#FFD21A" opacity="0.10"/>`;
    }).join('');
  if (style === 'noir')
    return `<path d="M0 ${h * 0.2} C ${w * 0.25} ${h * 0.35}, ${w * 0.4} ${h * 0.1}, ${w * 0.7} ${h * 0.3} S ${w} ${h * 0.2}, ${w} ${h * 0.25}" stroke="${p.glow}" stroke-width="2" fill="none" opacity="0.35"/>
      <path d="M0 ${h * 0.75} C ${w * 0.3} ${h * 0.6}, ${w * 0.55} ${h * 0.9}, ${w} ${h * 0.7}" stroke="${p.glow}" stroke-width="1.5" fill="none" opacity="0.25"/>`;
  if (style === 'clinic')
    return `<circle cx="${w * 0.2}" cy="${h * 0.25}" r="${h * 0.16}" fill="#fff" opacity="0.7"/>
      <path d="M${w * 0.82} ${h * 0.18} q ${w * 0.08} ${h * 0.1} 0 ${h * 0.3} q -${w * 0.08} -${h * 0.12} 0 -${h * 0.3}" fill="#5FA67F" opacity="0.75"/>
      <path d="M${w * 0.88} ${h * 0.28} q ${w * 0.06} ${h * 0.08} -${w * 0.02} ${h * 0.24} q -${w * 0.05} -${h * 0.1} ${w * 0.02} -${h * 0.24}" fill="#7DBE95" opacity="0.7"/>`;
  if (style === 'neon')
    return `<ellipse cx="${w * 0.6}" cy="${h * 0.86}" rx="${w * 0.22}" ry="${h * 0.05}" fill="none" stroke="#22D3EE" stroke-width="3" opacity="0.8"/>
      <ellipse cx="${w * 0.6}" cy="${h * 0.86}" rx="${w * 0.3}" ry="${h * 0.07}" fill="none" stroke="#A855F7" stroke-width="2" opacity="0.6"/>
      <circle cx="${w * 0.25}" cy="${h * 0.3}" r="${h * 0.3}" fill="#A855F7" opacity="0.18"/>
      ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${h * (0.1 + i * 0.1)}" x2="${w}" y2="${h * (0.1 + i * 0.1)}" stroke="#22D3EE" stroke-width="1" opacity="0.05"/>`).join('')}`;
  return `<circle cx="${w * 0.15}" cy="${h * 0.2}" r="${h * 0.35}" fill="${p.glow}" opacity="0.10"/>`;
}

// Rim-lit bust: shows where the AI puts a person of the target audience.
function person(p: Pal, x: number, h: number, style: ImpactStyle) {
  const c = style === 'noir' ? '#1B1813' : '#120F10';
  return `<g transform="translate(${x} ${h})">
    <path d="M-230 0 C -220 -170, -120 -230, 0 -235 C 120 -230, 220 -170, 230 0 Z" fill="${c}"/>
    <rect x="-46" y="-300" width="92" height="90" rx="30" fill="${c}"/>
    <ellipse cx="0" cy="-390" rx="92" ry="112" fill="${c}"/>
    <path d="M70 -470 C 120 -420, 110 -330, 80 -300" stroke="${p.glow}" stroke-width="6" fill="none" opacity="0.7"/>
    <path d="M200 -120 C 225 -80, 230 -40, 230 0" stroke="${p.glow}" stroke-width="6" fill="none" opacity="0.55"/>
  </g>`;
}

function heroSvg(style: ImpactStyle) {
  const p = PAL[style];
  const wide = style === 'impact' || style === 'noir';
  const w = wide ? 1600 : 1200;
  const h = 900;
  const id = `h${style}`;
  const bx = wide ? w * 0.74 : w * 0.56;
  return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    ${defs(p, id, w, h, style)}${decor(style, p, w, h)}
    <circle cx="${bx}" cy="${h * 0.5}" r="${h * 0.42}" fill="url(#gl${id})"/>
    ${wide || style === 'blast' ? person(p, wide ? w * 0.2 : w * 0.24, h, style) : ''}
    <ellipse cx="${bx}" cy="${h * 0.84}" rx="${h * 0.3}" ry="${h * 0.06}" fill="${p.floor}"/>
    <rect x="${bx - h * 0.3}" y="${h * 0.84}" width="${h * 0.6}" height="${h * 0.2}" fill="${p.floor}"/>
    ${bottle(p, bx, h * 0.52, 1.75, id)}
  </svg>`);
}

function packSvg(style: ImpactStyle, n: number) {
  const p = PAL[style];
  const id = `p${style}${n}`;
  const positions = n === 1 ? [[300, 330, 1.15]] : n === 2 ? [[220, 320, 1], [380, 340, 1.05]] : [[170, 310, 0.92], [430, 310, 0.92], [300, 345, 1.02]];
  return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    ${defs(p, id, 600, 600, style)}
    <circle cx="300" cy="300" r="260" fill="url(#gl${id})"/>
    ${positions.map(([x, y, s]) => bottle(p, x, y, s, id)).join('')}
  </svg>`);
}

const ING_COLORS = ['#C7A15A', '#B5653A', '#7FA7C9', '#C9455B'];
function ingredientSvg(style: ImpactStyle, i: number) {
  const p = PAL[style];
  const c = ING_COLORS[i % 4];
  const shapes = [
    `<ellipse cx="200" cy="230" rx="95" ry="70" fill="${c}"/><ellipse cx="170" cy="205" rx="40" ry="26" fill="#fff" opacity="0.25"/>`,
    `<path d="M120 300 C 140 180, 220 120, 290 110 C 270 190, 220 270, 120 300 Z" fill="${c}"/><path d="M130 290 L 280 120" stroke="#fff" stroke-width="5" opacity="0.4"/>`,
    `<polygon points="200,90 290,170 260,290 140,290 110,170" fill="${c}"/><polygon points="200,90 240,170 200,290 160,170" fill="#fff" opacity="0.2"/>`,
    `<circle cx="160" cy="210" r="56" fill="${c}"/><circle cx="240" cy="220" r="48" fill="${c}" opacity="0.85"/><circle cx="205" cy="160" r="40" fill="${c}" opacity="0.9"/>`,
  ];
  return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${style === 'clinic' ? '#FFFFFF' : p.bg}"/><stop offset="1" stop-color="${p.bg2}"/></radialGradient></defs>
    <rect width="400" height="400" fill="url(#g)"/>${shapes[i % 4]}
  </svg>`);
}

// Texts per style (same product, the voice changes).
const COPY: Record<ImpactStyle, { topBar: string; kicker: string; title: string; text: string; bullets: string[]; final: string; badge: string; benefitsTitle: string; packagesTitle: string; design: GeneratedCopy['design'] }> = {
  impact: {
    topBar: '🔥 Hasta 40% de descuento · Envío gratis · Pagas al recibir',
    kicker: 'Suplemento de energía diaria',
    title: 'Recupera tu **energía** | y tu ritmo',
    text: 'Una cápsula al día para sentirte activo de la mañana a la noche. Pagas cuando te llega.',
    bullets: ['Más energía todo el día', 'Mejor enfoque en tu rutina', 'Ingredientes naturales', 'Fácil de tomar'],
    final: 'Empieza **hoy** tu cambio',
    badge: 'Oferta de hoy',
    benefitsTitle: 'Beneficios de **Vítara**',
    packagesTitle: 'Elige tu **paquete**',
    design: { primary: '#E11D2A', accent: '#FF5A3C', dark: '#0B0B0F', light: '#16161C', vibe: 'bold' },
  },
  blast: {
    topBar: '⚡ ¡Oferta por tiempo limitado! Hasta 40% de descuento',
    kicker: '¡Energía al máximo!',
    title: '¡Desata tu **máxima** | energía!',
    text: '¡Siéntete imparable todo el día con Vítara! Y pagas solo cuando te llega a la puerta.',
    bullets: ['Más energía todo el día', 'Más ganas de entrenar', 'Enfoque al máximo', 'Confianza a tope'],
    final: '¡No esperes **más**!',
    badge: '¡Pídelo ya!',
    benefitsTitle: 'Beneficios **reales**',
    packagesTitle: '¡Elige tu paquete y **ahorra**!',
    design: { primary: '#FFD21A', accent: '#E3141C', dark: '#7A0B0B', light: '#140707', vibe: 'bold' },
  },
  noir: {
    topBar: 'Envío sin costo · Pago al recibir · Garantía de 30 días',
    kicker: 'Vítara Élite',
    title: 'Energía | sin **límites**',
    text: 'La fórmula premium para quienes exigen más de cada día: energía, enfoque y bienestar.',
    bullets: ['Energía sostenida', 'Enfoque mental', 'Ingredientes selectos', 'Bienestar integral'],
    final: 'Eleva tu **mejor** versión',
    badge: 'Edición limitada',
    benefitsTitle: 'Más que un **suplemento**',
    packagesTitle: 'Elige tu **experiencia**',
    design: { primary: '#C9A25C', accent: '#E7CF9A', dark: '#0A0907', light: '#15120E', vibe: 'luxury' },
  },
  clinic: {
    topBar: 'Envío gratis a todo el país · Pagas al recibir · Garantía de 30 días',
    kicker: 'Suplemento de energía',
    title: 'Energía y vitalidad | **para tu día a día**',
    text: 'Fórmula con ingredientes de origen natural, pensada para acompañar tu rutina diaria.',
    bullets: ['Ingredientes naturales', 'Una cápsula al día', 'Sin azúcar añadida', 'Garantía de 30 días'],
    final: 'Empieza a sentirte **mejor** hoy',
    badge: 'Envío gratis',
    benefitsTitle: 'Por qué elegir **Vítara**',
    packagesTitle: 'Elige tu **plan**',
    design: { primary: '#2F4A66', accent: '#3F8F7A', dark: '#0F1B2D', light: '#F2F6FA', vibe: 'fresh' },
  },
  neon: {
    topBar: '⚡ Activa tu energía · Hasta 40% de descuento · Pago al recibir',
    kicker: 'Energía de próxima generación',
    title: 'Activa tu | **siguiente nivel**',
    text: 'Energía, enfoque y vitalidad en una sola fórmula. Pagas cuando te llega.',
    bullets: ['Energía sostenida', 'Enfoque mental', 'Fuerza en tu rutina', 'Vitalidad diaria'],
    final: 'Activa tu **próximo nivel**',
    badge: 'Nivel activado',
    benefitsTitle: 'Tu energía, **optimizada**',
    packagesTitle: 'Elige tu **plan**',
    design: { primary: '#22D3EE', accent: '#A855F7', dark: '#060B1A', light: '#0D1631', vibe: 'tech' },
  },
};

export function demoLanding(style: ImpactStyle): LandingPageConfig {
  const c = COPY[style] || COPY.impact;
  const copy: GeneratedCopy = {
    productName: 'Vítara',
    category: 'Suplementos',
    eyebrow: c.kicker,
    headline: c.title.replace(/\s*\|\s*/g, ' '),
    subheadline: c.text,
    heroBullets: c.bullets.slice(0, 3),
    ctaText: 'Ordenar ahora',
    discountBadge: '-40%',
    urgencyText: '',
    painTitle: '',
    painPoints: [],
    solutionTitle: '',
    solutionText: '',
    benefits: [],
    benefitBlocks: [],
    stats: [],
    howItWorksTitle: '',
    howItWorks: [],
    comparisonTitle: '',
    comparison: [],
    faqs: [
      { question: '¿Cómo se toma?', answer: 'Una cápsula al día con el desayuno.' },
      { question: '¿Cuándo me llega?', answer: 'Entre 2 y 5 días hábiles según tu ciudad.' },
      { question: '¿Cómo pago?', answer: 'En efectivo cuando recibes el pedido en tu casa.' },
      { question: '¿Tiene garantía?', answer: 'Sí, 30 días. Si no te gusta, te devolvemos tu dinero.' },
    ],
    guaranteeText: 'Garantía de 30 días',
    finalCtaTitle: c.final,
    finalCtaText: '',
    seoTitle: 'Vítara — muestra de estilo',
    seoDescription: '',
    brandName: 'Vítara Labs',
    design: c.design,
    heroImagePrompt: '',
    solutionImagePrompt: '',
    impact: {
      topBar: c.topBar,
      heroKicker: c.kicker,
      heroTitle: c.title,
      heroText: c.text,
      heroBullets: c.bullets,
      trust: [
        { icon: 'Wallet', title: 'Pagas al recibir', text: 'En efectivo' },
        { icon: 'Truck', title: 'Envío gratis', text: 'A todo el país' },
        { icon: 'ShieldCheck', title: 'Garantía', text: '30 días' },
        { icon: 'Award', title: 'Calidad premium', text: 'Fórmula selecta' },
      ],
      benefitsTitle: c.benefitsTitle,
      benefits: [
        { icon: 'Zap', title: 'Más energía', text: 'Rinde de la mañana a la noche.' },
        { icon: 'Target', title: 'Mejor enfoque', text: 'Concéntrate en lo que importa.' },
        { icon: 'Dumbbell', title: 'Más ritmo', text: 'Ganas de moverte y entrenar.' },
        { icon: 'Smile', title: 'Bienestar', text: 'Siéntete bien cada día.' },
      ],
      ingredientsTitle: 'Ingredientes de **alto nivel**',
      ingredientsSubtitle: 'Seleccionados para acompañar tu energía diaria.',
      ingredients: [
        { name: 'Maca andina', text: 'Energía y resistencia.', imagePrompt: '' },
        { name: 'Ginseng', text: 'Vitalidad y enfoque.', imagePrompt: '' },
        { name: 'Magnesio', text: 'Apoya tu descanso.', imagePrompt: '' },
        { name: 'Vitamina B12', text: 'Ayuda a reducir el cansancio.', imagePrompt: '' },
      ],
      packagesTitle: c.packagesTitle,
      packagesSubtitle: 'Entre más llevas, menos pagas por cada frasco.',
      packBullets: [
        { units: 1, bullets: ['30 días de uso', 'Ideal para probar'] },
        { units: 2, bullets: ['60 días de uso', 'Mejor precio por frasco', 'El favorito'] },
        { units: 3, bullets: ['90 días de uso', 'Máximo ahorro', 'Para compartir'] },
      ],
      faqTitle: 'Preguntas **frecuentes**',
      finalTitle: c.final,
      finalText: 'Haz tu pedido en un minuto y paga cuando te llegue.',
      finalBadge: c.badge,
      heroImagePrompt: '',
      packImagePrompt: '',
    },
  };
  const hero = heroSvg(style);
  const landing = buildSalesLanding(
    copy,
    {
      productName: 'Vítara',
      brandName: 'Vítara Labs',
      productImage: packSvg(style, 1),
      extraImages: [],
      regularUnitPrice: 99900,
      offers: [
        { units: 1, price: 79900 },
        { units: 2, price: 129900, popular: true },
        { units: 3, price: 179900 },
      ],
      currency: 'COP',
      country: 'Colombia',
      whatsappNumber: '',
      shippingType: 'free',
      guaranteeDays: 30,
    },
    {
      benefits: [],
      impactHero: hero,
      packs: { '1': packSvg(style, 1), '2': packSvg(style, 2), '3': packSvg(style, 3) },
      ingredients: [0, 1, 2, 3].map((i) => ingredientSvg(style, i)),
    },
  );
  landing.id = `demo-${style}`;
  landing.slug = `muestra-${style}`;
  landing.impact = { ...landing.impact!, style };
  landing.countdown = { enabled: true, mode: 'daily', hours: 24, text: 'Termina en' };
  landing.reviews = [
    { id: 'r1', author: 'Opinión de ejemplo', location: 'Aquí van las tuyas', rating: 0, comment: 'Las opiniones reales que tú pongas aparecen en esta sección.', verifiedPurchase: false, date: '' },
  ];
  return landing;
}
