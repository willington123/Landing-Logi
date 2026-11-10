// Names of the Meta ads chats and orders came from ("Video faja testimonio · Campaña Fajas"), read once from the
// connected ad account and kept per store (settings row "meta_ad_names"), so Mensajes can say which ad brought
// each customer. Ads Meta can't find are asked again after a day.
import { db } from '@/lib/server/db';
import { adsConfig } from '@/lib/server/integrations';
import { adCreatives } from '@/lib/server/meta-ads';
import { AD_ID_RE } from '@/lib/ads';

export interface AdName {
  name: string;
  campaign: string;
  adset: string;
  thumb: string | null;
  preview: string | null;
  checkedAt: string;
}
const ROW = 'meta_ad_names';
const RETRY_MS = 24 * 3600_000;
const MAX_PER_CALL = 50;

async function read(): Promise<Record<string, AdName>> {
  const { data } = await (await db()).from('settings').select('data').eq('id', ROW).maybeSingle();
  return (data?.data as Record<string, AdName>) || {};
}

export async function adNames(ids: string[], opts: { lookup?: boolean; timeoutMs?: number } = {}): Promise<Record<string, AdName>> {
  const want = Array.from(new Set(ids.filter((id) => AD_ID_RE.test(id))));
  if (!want.length) return {};
  const known = await read().catch(() => ({}) as Record<string, AdName>);
  const now = Date.now();
  const missing = want.filter((id) => !known[id] || (!known[id].name && now - Date.parse(known[id].checkedAt) > RETRY_MS)).slice(0, MAX_PER_CALL);
  if (missing.length && opts.lookup !== false) {
    const cfg = await adsConfig().catch(() => null);
    if (cfg?.accounts.length) {
      const look = adCreatives({ ...cfg, accountId: cfg.accounts[0].id }, missing).catch(() => null);
      const got = await Promise.race([look, new Promise<null>((r) => setTimeout(() => r(null), opts.timeoutMs ?? 6000))]);
      if (got) {
        const at = new Date().toISOString();
        const fresh = await read().catch(() => ({}) as Record<string, AdName>);
        for (const id of missing) {
          const c = got.creatives[id];
          fresh[id] = c ? { name: c.name, campaign: c.campaign || '', adset: c.adset || '', thumb: c.thumb, preview: c.previewLink, checkedAt: at } : { name: '', campaign: '', adset: '', thumb: null, preview: null, checkedAt: at };
        }
        // Keep the newest 3.000.
        const keys = Object.keys(fresh);
        if (keys.length > 3000) keys.sort((a, b) => (fresh[a].checkedAt < fresh[b].checkedAt ? -1 : 1)).slice(0, keys.length - 3000).forEach((k) => delete fresh[k]);
        await (await db()).from('settings').upsert({ id: ROW, data: fresh }); // an error only means we ask again next time
        Object.assign(known, fresh);
      }
    }
  }
  return Object.fromEntries(want.filter((id) => known[id]?.name).map((id) => [id, known[id]]));
}
