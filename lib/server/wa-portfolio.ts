// Reusing a portfolio's WhatsApp connection: another of the person's stores already has a token (and app
// secret) for that Meta portfolio; list its WhatsApp accounts and numbers so a new store just picks one.
import { rawDb } from '@/lib/server/supabase';
import { roleIn, userOrgs } from '@/lib/server/accounts';
import { decrypt } from '@/lib/server/secrets';
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
  return (data || [])
    .filter((r) => (r.data as any)?.whatsapp?.mode === 'manual' && (r.data as any).whatsapp.token)
    .map((r) => {
      const w = (r.data as any).whatsapp;
      return { orgId: r.org_id, name: orgs.find((o) => o.id === r.org_id)?.name || 'Tienda', displayPhone: w.displayPhone || null, wabaId: w.wabaId || null };
    });
}

export class SourceError extends Error {
  userFacing = true;
}

// Credentials of a source store, only if the person manages it.
export async function sourceCredentials(uid: string, fromOrg: string) {
  const role = await roleIn(fromOrg, uid);
  if (role !== 'owner' && role !== 'admin') throw new SourceError('No administras esa tienda.');
  const w = (await storedIntegrations(fromOrg)).whatsapp;
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
export async function portfolioNumbers(uid: string, token: string, wabaId: string | null): Promise<{ wabas: WabaNumbers[]; note: string | null }> {
  const ids = new Map<string, string | null>();
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
      }
    } catch {
      note = 'Solo se ven los números de la cuenta de WhatsApp de esa tienda (el token no puede listar las demás del portafolio).';
    }
  }
  const mine = new Map((await userOrgs(uid)).map((o) => [o.id, o.name]));
  const wabas: WabaNumbers[] = [];
  for (const [id, name] of Array.from(ids)) {
    const d = await graphGet(`${id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100`, token).catch(() => null);
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
  return { wabas, note };
}
