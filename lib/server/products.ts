// Products sold only by WhatsApp, saved per store in the "settings" table (row "wa_products").
import { db, uploadPublicImage } from '@/lib/server/db';
import { productAsLanding, type CatalogProduct } from '@/lib/products';
import type { LandingPageConfig } from '@/lib/types';

const ROW = 'wa_products';
export const MAX_PRODUCTS = 100;

export async function getProducts(): Promise<CatalogProduct[]> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', ROW).maybeSingle();
  if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(error.message);
  const items = (data?.data as { items?: CatalogProduct[] } | null)?.items;
  return Array.isArray(items) ? items : [];
}

async function write(items: CatalogProduct[]) {
  const { error } = await (await db()).from('settings').upsert({ id: ROW, data: { items } });
  if (error) throw new Error(error.message);
}

// Adds or replaces one product. A pasted photo (data URL) is uploaded first.
export async function saveProduct(p: CatalogProduct): Promise<CatalogProduct> {
  const items = await getProducts();
  const next = p.image.startsWith('data:') ? { ...p, image: await uploadPublicImage(`products/${p.id}`, p.image) } : p;
  const i = items.findIndex((x) => x.id === p.id);
  if (i < 0 && items.length >= MAX_PRODUCTS) throw Object.assign(new Error(`Puedes tener hasta ${MAX_PRODUCTS} productos.`), { userFacing: true });
  await write(i < 0 ? [next, ...items] : items.map((x, k) => (k === i ? next : x)));
  return next;
}

export async function deleteProduct(id: string) {
  await write((await getProducts()).filter((x) => x.id !== id));
}

export async function getProduct(id: string): Promise<CatalogProduct | null> {
  return (await getProducts()).find((x) => x.id === id) || null;
}

// What can be sold: published landings and active WhatsApp products (as landings without a page).
export async function sellables(limit = 50): Promise<LandingPageConfig[]> {
  const [{ data }, products] = await Promise.all([
    (await db()).from('landings').select('data, published').order('updated_at', { ascending: false }).limit(limit),
    getProducts().catch(() => []),
  ]);
  const landings = (data || []).filter((r: any) => r.published !== false).map((r: any) => r.data as LandingPageConfig);
  return [...landings, ...products.filter((p) => p.active).map(productAsLanding)];
}
