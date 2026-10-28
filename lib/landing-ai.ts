import { LandingPageConfig, ProductCombo, SalesPageContent, LandingDesign } from './types';

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
}

export interface SalesLandingInput {
  productName: string;
  productImage: string;
  extraImages: string[];
  regularPrice: number;
  promoPrice: number;
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

function buildCombos(name: string, regular: number, promo: number, currency: string): ProductCombo[] {
  const round = (n: number) => Math.round(n / 100) * 100;
  const fmt = (n: number) => `$${n.toLocaleString('es-CO')} ${currency}`;
  const two = round(promo * 1.7);
  const three = round(promo * 2.3);
  const t = Date.now();
  return [
    { id: `c1-${t}`, name: `1 ${name}`, units: 1, regularPrice: regular, promoPrice: promo, savingsText: `Ahorras ${fmt(regular - promo)}`, badge: 'Individual', isPopular: false },
    { id: `c2-${t}`, name: `2 ${name}`, units: 2, regularPrice: regular * 2, promoPrice: two, savingsText: `Ahorras ${fmt(regular * 2 - two)}`, badge: 'MÁS ELEGIDO', isPopular: true },
    { id: `c3-${t}`, name: `3 ${name}`, units: 3, regularPrice: regular * 3, promoPrice: three, savingsText: `Ahorras ${fmt(regular * 3 - three)}`, badge: 'MEJOR PRECIO', isPopular: false },
  ];
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
    brandName: copy.brandName,
    featureChips: copy.featureChips || [],
    painTags: copy.painTags || [],
    productDetails: copy.productDetails,
    shippingInfo: copy.shippingInfo,
  };

  const generatedGallery = [images.hero, images.solution, ...images.benefits].filter(Boolean) as string[];
  const discount = Math.max(
    0,
    Math.round(((input.regularPrice - input.promoPrice) / (input.regularPrice || 1)) * 100)
  );

  return {
    id: `lp-${slug}`,
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
    regularPrice: input.regularPrice,
    promoPrice: input.promoPrice,
    currency: input.currency,
    discountBadge: copy.discountBadge || (discount > 0 ? `-${discount}%` : 'OFERTA'),
    urgencyText: copy.urgencyText,
    countdownMinutes: 0,
    stockLeft: 0,
    combos: buildCombos(name, input.regularPrice, input.promoPrice, input.currency),
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
