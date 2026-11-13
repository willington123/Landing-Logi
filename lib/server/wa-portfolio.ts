// Reusing a portfolio's WhatsApp connection: another of the person's stores already has a token (and app
// secret) for that Meta portfolio; list its WhatsApp accounts and numbers so a new store just picks one.
import { rawDb } from '@/lib/server/supabase';
import { roleIn, userOrgs } from '@/lib/server/accounts';
import { decrypt, encrypt } from '@/lib/server/secrets';
import { integrationsOrg } from '@/lib/server/tenant';

const env = (k: string) => (process.env[k] || '').trim();
// The platform's own store can be connected with the Vercel keys (WHATSAPP_TOKEN…) instead of saved ones.
const envWhatsApp = () => (env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID') ? { token: env('WHATSAPP_TOKEN'), wabaId: env('WHATSAPP_BUSINESS_ACCOUNT_ID') || null, appSecret: env('WHATSAPP_APP_SECRET') || null } : null);
import { orgForWhatsAppNumber, storedIntegrations } from '@/lib/server/integrations';
import { graphGet } from '@/lib/server/integrations-api';

export interface WaSource {
  orgId: string;
  name: string;
  displayPhone: string | null;
  wabaId: string | null;
}

// The person's other stores that connected WhatsApp with their own Meta app (token + app secret).
export async function waSources(uid: string, exceptOrg: string): Promise<WaSource[]> {
  const orgs = (await userOrgs(uid)).filter((o) => o.id !== exceptOrg && (o.role === 'owner' || o.role === 'admin'));
  if (!orgs.length) return [];
  const { data } = await rawDb().from('settings').select('org_id, data').eq('id', 'integrations').in('org_id', orgs.map((o) => o.id));
  const out: WaSource[] = (data || [])
    .filter((r) => (r.data as any)?.whatsapp?.mode === 'manual' && (r.data as any).whatsapp.token)
    .map((r) => {
      const w = (r.data as any).whatsapp;
      return { orgId: r.org_id, name: orgs.find((o) => o.id === r.org_id)?.name || 'Tienda', displayPhone: w.displayPhone || null, wabaId: w.wabaId || null };
    });
  // The store that uses the Vercel keys (no WhatsApp saved in Konnexa).
  const envOrg = integrationsOrg();
  const ew = envWhatsApp();
  const envStore = orgs.find((o) => o.id === envOrg);
  if (ew && ew.appSecret && envStore && !out.some((x) => x.orgId === envOrg) && !(data || []).some((r) => r.org_id === envOrg && (r.data as any)?.whatsapp)) {
    out.push({ orgId: envOrg, name: envStore.name || 'Tienda', displayPhone: null, wabaId: ew.wabaId });
  }
  return out;
}

export class SourceError extends Error {
  userFacing = true;
}

// Credentials of a source store, only if the person manages it.
export async function sourceCredentials(uid: string, fromOrg: string) {
  const role = await roleIn(fromOrg, uid);
  if (role !== 'owner' && role !== 'admin') throw new SourceError('No administras esa tienda.');
  const w = (await storedIntegrations(fromOrg)).whatsapp;
  // The store connected with the Vercel keys: its token and app secret are sealed for the new store.
  const ew = envWhatsApp();
  if (!w && fromOrg === integrationsOrg() && ew?.appSecret) return { token: ew.token, sealedToken: encrypt(ew.token), sealedSecret: encrypt(ew.appSecret), wabaId: ew.wabaId };
  if (!w || w.mode !== 'manual') throw new SourceError('Esa tienda no tiene WhatsApp conectado con su propia app de Meta.');
  const token = decrypt(w.token);
  if (!token) throw new SourceError('No se pudo leer la conexión de esa tienda. Vuelve a conectarla allá.');
  return { token, sealedToken: w.token, sealedSecret: w.appSecret || null, wabaId: w.wabaId || null };
}

export interface WabaNumbers {
  id: string;
  name: string | null;
  numbers: { id: string; display: string; name: string | null; quality: string | null; usedBy: string | null }[];
}

// WhatsApp accounts of the portfolio (the source's WABA, plus the others the token can see) and their numbers.
export async function portfolioNumbers(uid: string, token: string, wabaId: string | null, extraWaba?: string | null): Promise<{ wabas: WabaNumbers[]; note: string | null; extraError?: string | null }> {
  let extraError: string | null = null;
  const ids = new Map<string, string | null>();
  // A WhatsApp account the person pasted (e.g. one shared with this portfolio that Meta doesn't list).
  if (extraWaba) ids.set(extraWaba, null);
  if (wabaId) ids.set(wabaId, null);
  let note: string | null = null;
  if (wabaId) {
    try {
      const w = await graphGet(`${wabaId}?fields=name,owner_business_info`, token);
      ids.set(wabaId, w?.name || null);
      const biz = w?.owner_business_info?.id;
      if (biz) {
        const list = await graphGet(`${biz}/owned_whatsapp_business_accounts?fields=id,name&limit=100`, token);
        for (const x of list?.data || []) ids.set(String(x.id), x.name || null);
        // Accounts other portfolios shared with this one (e.g. a store's own portfolio gave it access).
        const shared = await graphGet(`${biz}/client_whatsapp_business_accounts?fields=id,name&limit=100`, token).catch(() => null);
        for (const x of shared?.data || []) ids.set(String(x.id), x.name || null);
      }
    } catch {
      note = 'Meta no deja que esa conexión liste las demás cuentas del portafolio. Si el número que buscas está en otra cuenta (por ejemplo, una compartida), pega abajo el identificador de esa cuenta de WhatsApp.';
    }
  }
  // Backup: the WhatsApp accounts the token itself is allowed to use (its granular scopes), which also covers
  // accounts shared with the portfolio when Meta doesn't list them above.
  const appId = env('META_APP_ID');
  const appSecret = env('META_APP_SECRET');
  {
    const dbg =
      (appId && appSecret ? await graphGet(`debug_token?input_token=${encodeURIComponent(token)}`, `${appId}|${appSecret}`).catch(() => null) : null) ||
      (await graphGet(`debug_token?input_token=${encodeURIComponent(token)}`, token).catch(() => null));
    for (const g of dbg?.data?.granular_scopes || []) {
      if (!String(g.scope || '').startsWith('whatsapp_business')) continue;
      for (const id of g.target_ids || []) if (!ids.has(String(id))) ids.set(String(id), null);
    }
  }
  if (extraWaba) {
    const w = await graphGet(`${extraWaba}?fields=name`, token).catch(() => null);
    if (w?.name) ids.set(extraWaba, w.name);
  }
  const mine = new Map((await userOrgs(uid)).map((o) => [o.id, o.name]));
  const wabas: WabaNumbers[] = [];
  for (const [id, name] of Array.from(ids)) {
    const d = await graphGet(`${id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100`, token).catch((e: any) => {
      if (id === extraWaba) extraError = e?.message || String(e);
      return null;
    });
    if (!d) continue;
    const numbers = [];
    for (const n of d.data || []) {
      const owner = await orgForWhatsAppNumber(String(n.id));
      numbers.push({
        id: String(n.id),
        display: String(n.display_phone_number || n.id),
        name: n.verified_name || null,
        quality: n.quality_rating || null,
        usedBy: owner ? mine.get(owner) || 'otra tienda' : null,
      });
    }
    wabas.push({ id, name, numbers });
  }
  return { wabas, note, extraError };
}
