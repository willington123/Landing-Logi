// Server-only data access for Supabase. Import only from API routes / server components.
// Uses the service role key, so it must never reach the browser.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { LandingPageConfig, OrderItem } from '@/lib/types';

const BUCKET = 'landing-images';

// Accepts both naming styles Supabase uses (dashboard "Connect" snippet and API settings).
const supabaseUrl = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
// Must be the SECRET key (sb_secret_… or the legacy service_role key), never the publishable one.
const supabaseSecret = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();

export function cloudEnabled(): boolean {
  const key = supabaseSecret();
  return Boolean(supabaseUrl() && key && !key.startsWith('sb_publishable_'));
}

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!cloudEnabled()) throw new Error('Supabase no está configurado (SUPABASE_URL y la clave secreta SUPABASE_SERVICE_ROLE_KEY).');
  if (!client) {
    client = createClient(supabaseUrl(), supabaseSecret(), {
      auth: { persistSession: false, autoRefreshToken: false },
      // Next.js caches fetch() by default; database reads must always be fresh.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
  }
  return client;
}

// ---------- images ----------

// Uploads every base64 image inside the landing to Storage and swaps it for its public URL.
// Files are named by content hash, so the same image is never uploaded twice.
async function uploadInlineImages(landing: LandingPageConfig): Promise<{ landing: LandingPageConfig; replaced: Record<string, string> }> {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      if (v.startsWith('data:image/')) found.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(landing);
  if (!found.size) return { landing, replaced: {} };

  const replaced: Record<string, string> = {};
  for (const dataUrl of Array.from(found)) {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) continue;
    const buf = Buffer.from(m[2], 'base64');
    const ext = m[1].split('/')[1].replace('jpeg', 'jpg').replace('+xml', '');
    const path = `${landing.id}/${createHash('sha1').update(buf).digest('hex').slice(0, 20)}.${ext}`;
    const { error } = await db().storage.from(BUCKET).upload(path, buf, { contentType: m[1], upsert: false, cacheControl: '31536000' });
    if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`No se pudo subir una imagen: ${error.message}`);
    replaced[dataUrl] = db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const swap = (v: any): any => {
    if (typeof v === 'string') return replaced[v] || v;
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  return { landing: swap(landing), replaced };
}

// ---------- landings ----------

export async function upsertLanding(input: LandingPageConfig) {
  const uploaded = await uploadInlineImages(input);
  const replaced = uploaded.replaced;
  // Visits are counted on the server; never let a save from the editor lower them.
  const { data: existing } = await db().from('landings').select('data').eq('id', input.id).maybeSingle();
  const storedViews = (existing?.data as LandingPageConfig | undefined)?.viewsCount || 0;
  const landing = { ...uploaded.landing, viewsCount: Math.max(storedViews, uploaded.landing.viewsCount || 0) };
  const { error } = await db()
    .from('landings')
    .upsert({ id: landing.id, slug: landing.slug, data: landing, published: landing.isPublished !== false, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return { landing, replaced };
}

export async function listLandings(): Promise<LandingPageConfig[]> {
  const { data, error } = await db().from('landings').select('data').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.data as LandingPageConfig);
}

export async function getPublicLanding(slugOrId: string): Promise<LandingPageConfig | null> {
  // Only slug-like values reach the filter (prevents filter injection).
  if (!/^[a-z0-9-]{1,120}$/i.test(slugOrId)) return null;
  const { data, error } = await db()
    .from('landings')
    .select('data')
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`)
    .eq('published', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as LandingPageConfig) || null;
}

// Counts a visit on a public landing (stored inside the landing JSON).
export async function incrementLandingViews(slugOrId: string) {
  const landing = await getPublicLanding(slugOrId);
  if (!landing) return;
  const next = { ...landing, viewsCount: (landing.viewsCount || 0) + 1 };
  const { error } = await db().from('landings').update({ data: next }).eq('id', landing.id);
  if (error) throw new Error(error.message);
}

export async function deleteLanding(id: string) {
  const { error } = await db().from('landings').delete().eq('id', id);
  if (error) throw new Error(error.message);
  const { data: files } = await db().storage.from(BUCKET).list(id, { limit: 1000 });
  if (files?.length) await db().storage.from(BUCKET).remove(files.map((f) => `${id}/${f.name}`));
}

// ---------- orders ----------

export async function createOrder(order: OrderItem) {
  const { error } = await db().from('orders').insert({
    id: order.id,
    order_number: order.orderNumber,
    landing_id: order.landingPageId || null,
    data: order,
    status: order.status,
    created_at: order.createdAt,
  });
  if (error) throw new Error(error.message);
  return order;
}

// Merges extra fields into an order's JSON (e.g. the Conversions API result).
export async function patchOrderData(id: string, patch: Record<string, unknown>) {
  const { data: row } = await db().from('orders').select('data').eq('id', id).maybeSingle();
  if (!row) return;
  await db().from('orders').update({ data: { ...(row.data as object), ...patch } }).eq('id', id);
}

export async function listOrders(limit = 500): Promise<OrderItem[]> {
  const { data, error } = await db().from('orders').select('data, status').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({ ...(r.data as OrderItem), status: r.status as OrderItem['status'] }));
}

export async function updateOrderStatus(id: string, status: OrderItem['status']) {
  const { data: row, error: readErr } = await db().from('orders').select('data').eq('id', id).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!row) return;
  const data = { ...(row.data as OrderItem), status, ...(status === 'confirmed_by_voice' ? { confirmedAt: new Date().toISOString() } : {}) };
  const { error } = await db().from('orders').update({ status, data }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- settings ----------

export async function getSettings<T>(): Promise<T | null> {
  const { data, error } = await db().from('settings').select('data').eq('id', 'default').maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) || null;
}

export async function saveSettings(settings: unknown) {
  const { error } = await db().from('settings').upsert({ id: 'default', data: settings });
  if (error) throw new Error(error.message);
}
