// Products sold only by WhatsApp (no landing page): what the assistant sells, what manual orders use and what goes
// to Dropi. Kept in the store's settings; ids start with "prd-" so they never clash with a landing.
import type { LandingPageConfig, ProductCombo } from '@/lib/types';

export interface ProductOffer {
  id: string;
  name: string; // "1 taladro", "2 x $259.900"
  units: number;
  price: number; // final price, paid on delivery
  regularPrice?: number; // "antes" price (optional)
}

export interface CatalogProduct {
  id: string; // prd-…
  name: string;
  image: string; // public URL ('' = none)
  description: string; // one or two lines for the assistant
  details: string; // benefits, size, colours, guarantee… one per line
  offers: ProductOffer[];
  active: boolean; // the assistant offers it
  updatedAt: string;
}

export const isCatalogId = (id: string | null | undefined) => typeof id === 'string' && id.startsWith('prd-');
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const rid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function cleanProduct(input: any): CatalogProduct | string {
  const name = str(input?.name, 80);
  if (!name) return 'Ponle un nombre al producto.';
  const offers: ProductOffer[] = [];
  for (const o of Array.isArray(input?.offers) ? input.offers.slice(0, 6) : []) {
    const units = Math.round(Number(o?.units));
    const price = Math.round(Number(String(o?.price ?? '').replace(/[^\d]/g, '')));
    const regular = Math.round(Number(String(o?.regularPrice ?? '').replace(/[^\d]/g, '')));
    if (!units && !price) continue;
    if (!(units >= 1 && units <= 50)) return `${name}: cada oferta necesita las unidades (1 a 50).`;
    if (!(price >= 1000)) return `${name}: escribe el precio de la oferta de ${units} ${units === 1 ? 'unidad' : 'unidades'}.`;
    if (offers.some((x) => x.units === units)) return `${name}: hay dos ofertas con ${units} ${units === 1 ? 'unidad' : 'unidades'}.`;
    offers.push({
      id: /^[\w-]{1,40}$/.test(String(o?.id ?? '')) ? String(o.id) : rid('of-'),
      name: str(o?.name, 60) || `${units} ${units === 1 ? 'unidad' : 'unidades'}`,
      units,
      price,
      ...(regular > price ? { regularPrice: regular } : {}),
    });
  }
  if (!offers.length) return `${name}: agrega al menos una oferta con su precio.`;
  offers.sort((a, b) => a.units - b.units);
  // A photo just picked comes as a data URL (much longer than a link): never cut it, or the saved image is broken.
  const rawImage = String(input?.image ?? '').trim();
  const image = rawImage.startsWith('data:image/') ? (rawImage.length <= 4_500_000 ? rawImage : '') : str(rawImage, 600);
  return {
    id: isCatalogId(input?.id) && /^[\w-]{4,40}$/.test(input.id) ? input.id : rid('prd-'),
    name,
    image: /^https?:\/\//.test(image) || image.startsWith('data:image/') ? image : '',
    description: str(input?.description, 300),
    details: str(input?.details, 2000),
    offers,
    active: input?.active !== false,
    updatedAt: new Date().toISOString(),
  };
}

// Seen by the assistant, the order form and Dropi as if it were a landing (without a page).
export function productAsLanding(p: CatalogProduct): LandingPageConfig {
  const combos: ProductCombo[] = p.offers.map((o, i) => ({
    id: o.id,
    name: o.name,
    units: o.units,
    regularPrice: o.regularPrice || o.price,
    promoPrice: o.price,
    savingsText: '',
    isDefault: i === 0,
  }));
  const benefits = p.details
    .split('\n')
    .map((l) => l.replace(/^[\s\-•*]+/, '').trim())
    .filter(Boolean)
    .map((title, i) => ({ id: `b${i}`, icon: '', title, description: '' }));
  return {
    id: p.id,
    kind: 'product',
    slug: '',
    title: p.name,
    headline: p.description,
    subheadline: '',
    productName: p.name,
    category: '',
    mainImage: p.image,
    galleryImages: [],
    regularPrice: combos[0]?.regularPrice || 0,
    promoPrice: combos[0]?.promoPrice || 0,
    currency: 'COP',
    country: 'Colombia',
    combos,
    benefits,
    features: [],
    reviews: [],
    faqs: [],
    paymentMethods: ['cash_on_delivery'],
  } as unknown as LandingPageConfig;
}
