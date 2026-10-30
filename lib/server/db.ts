// Server-only data access for Supabase. Import only from API routes / server components.
// Uses the service role key, so it must never reach the browser.
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudEnabled, rawDb } from '@/lib/server/supabase';
import { currentOrgId } from '@/lib/server/tenant';
import type { LandingPageConfig, OrderItem } from '@/lib/types';

export { cloudEnabled };

const BUCKET = 'landing-images';

// Tables whose rows belong to one account (organization). db() limits every query to the current one.
const TENANT_TABLES = new Set(['landings', 'orders', 'settings', 'calls', 'wa_conversations', 'wa_messages']);

const withOrg = (v: any, org: string) => (Array.isArray(v) ? v.map((r) => ({ ...r, org_id: org })) : { ...v, org_id: org });
const withoutOrg = (v: any) => {
  if (!v || typeof v !== 'object') return v;
  const { org_id: _ignored, ...rest } = v;
  return rest;
};

type TableBuilder = ReturnType<SupabaseClient['from']>;
export interface ScopedTable {
  select: TableBuilder['select'];
  update: TableBuilder['update'];
  delete: TableBuilder['delete'];
  insert: TableBuilder['insert'];
  upsert: TableBuilder['upsert'];
}
export interface ScopedDb {
  from(table: string): ScopedTable;
  orgId: string;
}

// Database access for the current account: reads, updates and deletes are filtered by org_id,
// inserts and upserts get it set. Rows of other accounts are never visible or writable.
export async function db(): Promise<ScopedDb> {
  if (!cloudEnabled()) rawDb(); // throws the "not configured" message
  const org = await currentOrgId();
  const c = rawDb();
  return {
    orgId: org,
    from(table: string) {
      if (!TENANT_TABLES.has(table)) throw new Error(`Tabla sin cuenta: ${table}. Usa rawDb() para tablas globales.`);
      const b = c.from(table);
      return {
        select: (...args: any[]) => (b.select as any)(...args).eq('org_id', org),
        update: (v: any, o?: any) => b.update(withoutOrg(v), o).eq('org_id', org),
        delete: (o?: any) => b.delete(o).eq('org_id', org),
        insert: (v: any, o?: any) => b.insert(withOrg(v, org), o),
        // Only for tables whose primary key includes org_id (settings, wa_conversations) or with ignoreDuplicates.
        upsert: (v: any, o?: any) => b.upsert(withOrg(v, org), o),
      } as ScopedTable;
    },
  };
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
    const { error } = await rawDb().storage.from(BUCKET).upload(path, buf, { contentType: m[1], upsert: false, cacheControl: '31536000' });
    if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`No se pudo subir una imagen: ${error.message}`);
    replaced[dataUrl] = rawDb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
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

// Only values that are safe inside a PostgREST filter.
const safeKey = (v: string) => (/^[\w-]{1,120}$/.test(v || '') ? v : '__invalid__');

export async function upsertLanding(input: LandingPageConfig) {
  const uploaded = await uploadInlineImages(input);
  const replaced = uploaded.replaced;
  const d = await (await db());
  // The id and the link (slug) are unique across all accounts: never touch another account's landing.
  const { data: taken } = await rawDb().from('landings').select('id, slug, org_id').or(`id.eq.${safeKey(input.id)},slug.eq.${safeKey(input.slug)}`);
  for (const t of taken || []) {
    if (t.org_id !== d.orgId) {
      if (t.slug === input.slug) throw new Error('Ese enlace de landing ya está en uso. Cambia el enlace (slug) por otro.');
      throw new Error('No se pudo guardar la landing. Vuelve a cargar la página e inténtalo de nuevo.');
    }
  }
  // Visits are counted on the server; never let a save from the editor lower them.
  const { data: existing } = await d.from('landings').select('data').eq('id', input.id).maybeSingle();
  const storedViews = (existing?.data as LandingPageConfig | undefined)?.viewsCount || 0;
  const landing = { ...uploaded.landing, viewsCount: Math.max(storedViews, uploaded.landing.viewsCount || 0) };
  const row = { slug: landing.slug, data: landing, published: landing.isPublished !== false, updated_at: new Date().toISOString() };
  const { error } = existing ? await d.from('landings').update(row).eq('id', landing.id) : await d.from('landings').insert({ id: landing.id, ...row });
  if (error) throw new Error(/landings_slug_key|duplicate key/.test(error.message) ? 'Ese enlace de landing ya está en uso. Cambia el enlace (slug) por otro.' : error.message);
  return { landing, replaced };
}

export async function listLandings(): Promise<LandingPageConfig[]> {
  const { data, error } = await (await db()).from('landings').select('data').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  const landings = (data || []).map((r) => r.data as LandingPageConfig);
  // Orders are counted from the orders table (the number stored in the landing JSON is never updated by the server).
  const counts = await countOrdersByLanding(landings.map((l) => l.id));
  return landings.map((l) => ({ ...l, ordersCount: counts[l.id] ?? l.ordersCount ?? 0 }));
}

// Number of orders per landing (one small count query each, run in parallel).
async function countOrdersByLanding(ids: string[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const { count, error } = await (await db()).from('orders').select('id', { count: 'exact', head: true }).eq('landing_id', id);
      return [id, error ? undefined : count ?? 0] as const;
    }),
  );
  const out: Record<string, number> = {};
  for (const [id, n] of entries) if (n !== undefined) out[id] = n;
  return out;
}

// A published landing by its link or id, from any account (public pages). orgId says whose it is.
export async function getPublicLandingWithOrg(slugOrId: string): Promise<{ landing: LandingPageConfig; orgId: string } | null> {
  // Only slug-like values reach the filter (prevents filter injection).
  if (!/^[a-z0-9-]{1,120}$/i.test(slugOrId)) return null;
  const { data, error } = await rawDb()
    .from('landings')
    .select('data, org_id')
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`)
    .eq('published', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { landing: data.data as LandingPageConfig, orgId: data.org_id as string } : null;
}

export async function getPublicLanding(slugOrId: string): Promise<LandingPageConfig | null> {
  return (await getPublicLandingWithOrg(slugOrId))?.landing || null;
}

// Counts a visit on a public landing (stored inside the landing JSON).
export async function incrementLandingViews(slugOrId: string) {
  const found = await getPublicLandingWithOrg(slugOrId);
  if (!found) return;
  const next = { ...found.landing, viewsCount: (found.landing.viewsCount || 0) + 1 };
  const { error } = await rawDb().from('landings').update({ data: next }).eq('id', found.landing.id).eq('org_id', found.orgId);
  if (error) throw new Error(error.message);
}

export async function deleteLanding(id: string) {
  const { data: gone, error } = await (await (await db())).from('landings').delete().eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!gone?.length) return; // not this account's landing: leave its images alone
  const { data: files } = await rawDb().storage.from(BUCKET).list(id, { limit: 1000 });
  if (files?.length) await rawDb().storage.from(BUCKET).remove(files.map((f) => `${id}/${f.name}`));
}

// ---------- orders ----------

export async function createOrder(order: OrderItem) {
  const { error } = await (await db()).from('orders').insert({
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
  const { data: row } = await (await db()).from('orders').select('data').eq('id', id).maybeSingle();
  if (!row) return;
  await (await db()).from('orders').update({ data: { ...(row.data as object), ...patch } }).eq('id', id);
}

export async function listOrders(limit = 500): Promise<OrderItem[]> {
  const { data, error } = await (await db()).from('orders').select('data, status').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({ ...(r.data as OrderItem), status: r.status as OrderItem['status'] }));
}

export async function updateOrderStatus(id: string, status: OrderItem['status']) {
  const { data: row, error: readErr } = await (await db()).from('orders').select('data').eq('id', id).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!row) return;
  const data = { ...(row.data as OrderItem), status, ...(status === 'confirmed_by_voice' ? { confirmedAt: new Date().toISOString() } : {}) };
  const { error } = await (await db()).from('orders').update({ status, data }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Corrects the delivery address. The first address is kept as previousAddress.
export async function updateOrderAddress(id: string, fields: { address: string; city: string; department: string }) {
  const { data: row, error: readErr } = await (await db()).from('orders').select('data').eq('id', id).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!row) return null;
  const cur = row.data as OrderItem;
  const changed = cur.address !== fields.address || cur.city !== fields.city || cur.department !== fields.department;
  const prev = [cur.address, cur.city, cur.department].filter(Boolean).join(', ');
  const data = { ...cur, ...fields, ...(changed && !cur.previousAddress ? { previousAddress: prev } : {}) };
  const { error } = await (await db()).from('orders').update({ data }).eq('id', id);
  if (error) throw new Error(error.message);
  return data;
}

// Deletes orders for good. WhatsApp conversations keep their messages; their order link is cleared.
export async function deleteOrders(ids: string[]): Promise<number> {
  const { data, error } = await (await db()).from('orders').delete().in('id', ids).select('id');
  if (error) throw new Error(error.message);
  return data?.length || 0;
}

// ---------- settings ----------

export async function getSettings<T>(): Promise<T | null> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', 'default').maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) || null;
}

export async function saveSettings(settings: unknown) {
  const { error } = await (await db()).from('settings').upsert({ id: 'default', data: settings });
  if (error) throw new Error(error.message);
}
