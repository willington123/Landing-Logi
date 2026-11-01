import { LandingPageConfig, ProductCombo, SalesPageContent, LandingDesign, ImageSection } from './types';

// Icons the AI may pick; the renderer maps each name to a lucide-react icon.
export const ICON_NAMES = [
  'Zap', 'ShieldCheck', 'Clock', 'Heart', 'Sparkles', 'Battery', 'Droplets', 'Sun', 'Moon', 'Leaf',
  'Flame', 'Smile', 'Frown', 'AlertTriangle', 'Wallet', 'Truck', 'Award', 'Target', 'Feather', 'Wind',
  'Thermometer', 'Dumbbell', 'Home', 'Baby', 'PawPrint', 'Smartphone', 'Wrench', 'Gem', 'Eye', 'Timer',
] as const;

export interface GeneratedCopy {
  productName: string;
  category: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  heroBullets: string[];
  ctaText: string;
  discountBadge: string;
  urgencyText: string;
  painTitle: string;
  painPoints: { icon: string; title: string; text: string }[];
  solutionTitle: string;
  solutionText: string;
  benefits: { icon: string; title: string; description: string }[];
  benefitBlocks: { title: string; text: string; bullets: string[]; imagePrompt: string }[];
  stats: { value: string; label: string }[];
  howItWorksTitle: string;
  howItWorks: { title: string; text: string }[];
  comparisonTitle: string;
  comparison: { feature: string; us: string; others: string }[];
  faqs: { question: string; answer: string }[];
  guaranteeText: string;
  finalCtaTitle: string;
  finalCtaText: string;
  seoTitle: string;
  seoDescription: string;
  brandName?: string;
  featureChips?: { icon: string; text: string }[];
  painTags?: string[];
  productDetails?: string;
  shippingInfo?: string;
  design: { primary: string; accent: string; dark: string; light: string; vibe: string };
  heroImagePrompt: string;
  solutionImagePrompt: string;
  // "Secciones de imagen" mode: Claude's art concept and one prompt per graphic section.
  concept?: { name: string; artDirection: string };
  sections?: Omit<ImageSection, 'id' | 'image'>[];
}

export interface OfferInput {
  units: number;
  price: number; // total price for all units
  label?: string; // optional badge, e.g. "Más vendido"
  popular?: boolean;
  selected?: boolean; // pre-selected when the page opens
}

export interface SalesLandingInput {
  productName: string;
  brandName: string;
  productImage: string;
  extraImages: string[];
  regularUnitPrice: number; // optional "before" price per unit, 0 = none
  offers: OfferInput[];
  currency: string;
  country: string;
  whatsappNumber: string;
  shippingType: 'free' | 'calculated';
  guaranteeDays: number;
}

export interface GeneratedImages {
  hero?: string;
  solution?: string;
  benefits: (string | undefined)[];
  sections?: (string | undefined)[]; // same order as copy.sections
}

const HEX = /^#[0-9a-f]{6}$/i;
const safeHex = (v: string | undefined, fallback: string) => (v && HEX.test(v.trim()) ? v.trim() : fallback);

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'producto'
  );
}

export const unitsLabel = (u: number) => `${u} ${u === 1 ? 'unidad' : 'unidades'}`;

// Turns the seller's offers into the combos shown on the page. Nothing is invented:
// prices, quantities and badges come from the seller.
export function buildCombos(offers: OfferInput[], regularUnit: number, currency: string): ProductCombo[] {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
  const t = Date.now();
  const valid = offers.filter((o) => o.units > 0 && o.price > 0);
  const popularIdx = Math.max(0, valid.findIndex((o) => o.popular));
  return valid.map((o, i) => {
    const regular = regularUnit > 0 ? regularUnit * o.units : o.price;
    const parts: string[] = [];
    if (o.units > 1) parts.push(`${fmt(o.price / o.units)} ${currency} c/u`);
    if (regular > o.price) parts.push(`Ahorras ${fmt(regular - o.price)} ${currency}`);
    return {
      id: `c${i}-${t}`,
      name: unitsLabel(o.units),
      units: o.units,
      regularPrice: regular,
      promoPrice: o.price,
      savingsText: parts.join(' · '),
      badge: o.label?.trim() || undefined,
      isPopular: i === popularIdx && valid.length > 1,
      isDefault: Boolean(o.selected) || undefined,
    };
  });
}

export function buildSalesLanding(
  copy: GeneratedCopy,
  input: SalesLandingInput,
  images: GeneratedImages
): LandingPageConfig {
  const name = (input.productName || copy.productName || 'Producto').trim();
  const slug = `${slugify(name)}-${Date.now().toString(36).slice(-4)}`;
  const now = new Date().toISOString();
  const t = Date.now();

  const design: LandingDesign = {
    primary: safeHex(copy.design?.primary, '#FF252B'),
    accent: safeHex(copy.design?.accent, '#FF5A16'),
    dark: safeHex(copy.design?.dark, '#0F172A'),
    light: safeHex(copy.design?.light, '#F8FAFC'),
    vibe: (['bold', 'luxury', 'fresh', 'tech', 'warm'].includes(copy.design?.vibe)
      ? copy.design.vibe
      : 'bold') as LandingDesign['vibe'],
  };

  const sales: SalesPageContent = {
    eyebrow: copy.eyebrow,
    heroBullets: copy.heroBullets || [],
    ctaText: copy.ctaText || 'Pedir ahora',
    heroImage: images.hero,
    painTitle: copy.painTitle,
    painPoints: copy.painPoints || [],
    solutionTitle: copy.solutionTitle,
    solutionText: copy.solutionText,
    solutionImage: images.solution,
    benefitBlocks: (copy.benefitBlocks || []).map((b, i) => ({
      title: b.title,
      text: b.text,
      bullets: b.bullets || [],
      image: images.benefits[i],
    })),
    stats: copy.stats || [],
    howItWorksTitle: copy.howItWorksTitle,
    howItWorks: copy.howItWorks || [],
    comparisonTitle: copy.comparisonTitle,
    comparison: copy.comparison || [],
    finalCtaTitle: copy.finalCtaTitle,
    finalCtaText: copy.finalCtaText,
    brandName: input.brandName.trim() || name,
    featureChips: copy.featureChips || [],
    painTags: copy.painTags || [],
    productDetails: copy.productDetails,
    shippingInfo: copy.shippingInfo,
  };

  const generatedGallery = [images.hero, images.solution, ...images.benefits].filter(Boolean) as string[];
  const combos = buildCombos(input.offers, input.regularUnitPrice, input.currency);
  // Headline price = the cheapest entry offer (usually the minimum quantity).
  const entry = combos[0];
  const promoPrice = entry?.promoPrice || 0;
  const regularPrice = entry?.regularPrice || promoPrice;
  const discount = Math.max(0, Math.round(((regularPrice - promoPrice) / (regularPrice || 1)) * 100));

  const imageSections: ImageSection[] = (copy.sections || [])
    .map((x, i) => ({ id: `s-${i}-${t}`, kind: x.kind, alt: x.alt || '', prompt: x.prompt, aspect: x.aspect, useReviewImages: x.useReviewImages || undefined, image: images.sections?.[i] })); // failed ones stay so the editor can retry them

  return {
    id: `lp-${slug}`,
    ...(imageSections.some((x) => x.image) ? { imageSections, artConcept: copy.concept } : {}),
    layout: 'sales-v2',
    country: input.country,
    design,
    sales,
    slug,
    title: name,
    headline: copy.headline,
    subheadline: copy.subheadline,
    productName: name,
    category: copy.category || 'General',
    mainImage: input.productImage,
    galleryImages: [...input.extraImages, ...generatedGallery].slice(0, 6),
    regularPrice,
    promoPrice,
    currency: input.currency,
    discountBadge: discount > 0 ? `-${discount}%` : '',
    urgencyText: copy.urgencyText,
    countdownMinutes: 0,
    stockLeft: 0,
    combos,
    benefits: (copy.benefits || []).map((b, i) => ({ id: `b-${i}-${t}`, ...b })),
    features: (copy.benefitBlocks || []).map((b, i) => ({
      id: `f-${i}-${t}`,
      title: b.title,
      description: b.text,
      image: images.benefits[i],
    })),
    reviews: [], // real reviews are added by the seller in the editor
    faqs: (copy.faqs || []).map((f, i) => ({ id: `faq-${i}-${t}`, ...f })),
    paymentMethods: ['cash_on_delivery'],
    shippingCostText: input.shippingType === 'calculated' ? 'Envío según destino' : 'Envío gratis',
    guaranteeText: copy.guaranteeText,
    guaranteeDays: input.guaranteeDays,
    whatsappNumber: input.whatsappNumber,
    whatsappDirectMessage: `Hola, quiero información sobre ${name}.`,
    themeStyle: 'impact-vibrant',
    primaryColor: design.primary,
    accentColor: design.accent,
    enableStickyBar: true,
    enableRecentSalesPopup: false,
    seoTitle: copy.seoTitle,
    seoDescription: copy.seoDescription,
    isPublished: true,
    publishedUrl: `/p/${slug}`,
    viewsCount: 0,
    ordersCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}
