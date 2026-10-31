// Meta Ads (Marketing API, read-only): connect a store's ad account and read spend + creatives per ad.
import { createHmac, timingSafeEqual } from 'crypto';
import { GRAPH_VERSION } from '@/lib/server/whatsapp';
import type { AdsConfig } from '@/lib/server/integrations';

const env = (k: string) => (process.env[k] || '').trim();
const GRAPH = () => `${env('META_GRAPH_URL') || 'https://graph.facebook.com'}/${GRAPH_VERSION}`;
export const ADS_SCOPE = 'ads_read';

export class AdsError extends Error {
  userFacing = true;
  constructor(
    message: string,
    public expired = false,
  ) {
    super(message);
  }
}

async function graph(path: string, token: string | null, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH()}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(20000), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error || {};
    // 190 = invalid/expired token; 200/10 = missing permission.
    if (e.code === 190) throw new AdsError('La conexión con Meta Ads venció o fue revocada. Vuelve a conectarla en Integraciones.', true);
    if (e.code === 200 || e.code === 10) throw new AdsError('Meta no dio permiso para leer esta cuenta publicitaria (ads_read).');
    if (e.code === 17 || e.code === 4 || e.code === 80004) throw new AdsError('Meta está limitando las consultas en este momento. Intenta en unos minutos.');
    throw new AdsError(e.error_user_msg || e.message || `Meta respondió HTTP ${res.status}`);
  }
  return data;
}

// ---------- connecting ----------

export const oauthAvailable = () => Boolean(env('META_APP_ID') && env('META_APP_SECRET'));

const stateSecret = () => `lp-ads:${env('AUTH_SECRET') || env('ADMIN_PASSWORD') || env('SUPABASE_SERVICE_ROLE_KEY')}`;
export function signState(orgId: string, uid: string) {
  const exp = Date.now() + 15 * 60000;
  const body = `${orgId}.${uid}.${exp}`;
  return `${Buffer.from(body).toString('base64url')}.${createHmac('sha256', stateSecret()).update(body).digest('base64url')}`;
}
export function checkState(state: string | null, orgId: string, uid: string): boolean {
  const [b, sig] = String(state || '').split('.');
  if (!b || !sig) return false;
  const body = Buffer.from(b, 'base64url').toString();
  const want = Buffer.from(createHmac('sha256', stateSecret()).update(body).digest('base64url'));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  const [o, u, exp] = body.split('.');
  return o === orgId && u === uid && Number(exp) > Date.now();
}

export function oauthUrl(redirectUri: string, state: string) {
  const u = new URL(`${env('META_OAUTH_URL') || 'https://www.facebook.com'}/${GRAPH_VERSION}/dialog/oauth`);
  u.searchParams.set('client_id', env('META_APP_ID'));
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('scope', ADS_SCOPE);
  u.searchParams.set('response_type', 'code');
  return u.toString();
}

// Code -> long-lived user token (about 60 days).
export async function exchangeCode(code: string, redirectUri: string): Promise<{ token: string; expiresAt: string | null }> {
  const short = await graph('oauth/access_token', null, { client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), redirect_uri: redirectUri, code });
  const long = await graph('oauth/access_token', null, {
    grant_type: 'fb_exchange_token',
    client_id: env('META_APP_ID'),
    client_secret: env('META_APP_SECRET'),
    fb_exchange_token: String(short.access_token),
  }).catch(() => short);
  const secs = Number(long.expires_in);
  return { token: String(long.access_token), expiresAt: secs > 0 ? new Date(Date.now() + secs * 1000).toISOString() : null };
}

export interface AdAccount {
  id: string; // numeric, without act_
  name: string;
  currency: string;
  active: boolean;
}

const toAccount = (a: any): AdAccount => ({
  id: String(a.account_id || String(a.id || '').replace(/^act_/, '')),
  name: String(a.name || a.account_id || ''),
  currency: String(a.currency || ''),
  active: Number(a.account_status) === 1,
});

export async function listAdAccounts(token: string): Promise<AdAccount[]> {
  const d = await graph('me/adaccounts', token, { fields: 'account_id,name,currency,account_status', limit: '200' });
  return (d.data || []).map(toAccount);
}

export const cleanAccountId = (v: unknown) => String(v ?? '').replace(/^act_/i, '').replace(/\D/g, '').slice(0, 25);

export async function adAccount(token: string, accountId: string): Promise<AdAccount> {
  return toAccount(await graph(`act_${accountId}`, token, { fields: 'account_id,name,currency,account_status' }));
}

// ---------- reading spend and creatives ----------

export interface AdInsight {
  adId: string;
  adName: string;
  campaignName: string;
  adsetName: string;
  spend: number;
  impressions: number;
  clicks: number; // link clicks
  metaChats: number; // messaging conversations started (Meta's count)
}

const cache = new Map<string, { data: unknown; until: number }>();
async function cached<T>(key: string, ms: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.data as T;
  const data = await load();
  cache.set(key, { data, until: Date.now() + ms });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return data;
}
export const forgetAdsCache = () => cache.clear();

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const action = (actions: any[] | undefined, ...types: string[]) => (actions || []).filter((a) => types.includes(a?.action_type)).reduce((n, a) => n + num(a.value), 0);

export async function adInsights(cfg: AdsConfig, since: string, until: string): Promise<AdInsight[]> {
  if (!cfg.accountId) return [];
  return cached(`ins:${cfg.accountId}:${since}:${until}`, 10 * 60000, async () => {
    const out: AdInsight[] = [];
    let d = await graph(`act_${cfg.accountId}/insights`, cfg.token, {
      level: 'ad',
      fields: 'ad_id,ad_name,campaign_name,adset_name,spend,impressions,inline_link_clicks,actions',
      time_range: JSON.stringify({ since, until }),
      limit: '500',
    });
    for (let page = 0; page < 10; page++) {
      for (const r of d.data || []) {
        out.push({
          adId: String(r.ad_id),
          adName: String(r.ad_name || ''),
          campaignName: String(r.campaign_name || ''),
          adsetName: String(r.adset_name || ''),
          spend: num(r.spend),
          impressions: num(r.impressions),
          clicks: num(r.inline_link_clicks),
          metaChats: action(r.actions, 'onsite_conversion.messaging_conversation_started_7d'),
        });
      }
      const after = d.paging?.cursors?.after;
      if (!d.paging?.next || !after) break;
      d = await graph(`act_${cfg.accountId}/insights`, cfg.token, {
        level: 'ad',
        fields: 'ad_id,ad_name,campaign_name,adset_name,spend,impressions,inline_link_clicks,actions',
        time_range: JSON.stringify({ since, until }),
        limit: '500',
        after,
      });
    }
    return out;
  });
}

export interface AdCreative {
  name: string;
  status: string; // ACTIVE, PAUSED, ...
  thumb: string | null;
  kind: 'video' | 'image' | 'other';
}

// Thumbnails and status for a list of ads. Tries the account's /ads edge (bigger thumbnails), then a plain
// multi-id read. Failures are not cached and are reported so the page can say why images are missing.
const CREATIVE_FIELDS = 'id,name,effective_status,creative.thumbnail_width(256).thumbnail_height(256){thumbnail_url,image_url,object_type,video_id}';
const CREATIVE_FIELDS_PLAIN = 'id,name,effective_status,creative{thumbnail_url,image_url,object_type,video_id}';

function toCreative(a: any): AdCreative {
  const c = a?.creative || {};
  return {
    name: String(a?.name || ''),
    status: String(a?.effective_status || ''),
    thumb: c.thumbnail_url || c.image_url || null,
    kind: c.video_id || c.object_type === 'VIDEO' ? 'video' : c.image_url || c.object_type === 'PHOTO' ? 'image' : 'other',
  };
}

export async function adCreatives(cfg: AdsConfig, ids: string[]): Promise<{ creatives: Record<string, AdCreative>; error: string | null }> {
  const out: Record<string, AdCreative> = {};
  const todo = Array.from(new Set(ids.filter((id) => /^\d{6,25}$/.test(id))));
  let error: string | null = null;
  for (let i = 0; i < todo.length; i += 50) {
    const chunk = todo.slice(i, i + 50);
    const key = `cr:${cfg.accountId}:${chunk.join(',')}`;
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) {
      Object.assign(out, hit.data as Record<string, AdCreative>);
      continue;
    }
    const got: Record<string, AdCreative> = {};
    const attempts: (() => Promise<void>)[] = [
      async () => {
        const d = await graph(`act_${cfg.accountId}/ads`, cfg.token, {
          fields: CREATIVE_FIELDS,
          filtering: JSON.stringify([{ field: 'ad.id', operator: 'IN', value: chunk }]),
          limit: '100',
        });
        for (const a of d.data || []) got[String(a.id)] = toCreative(a);
      },
      async () => {
        const d = await graph('', cfg.token, { ids: chunk.join(','), fields: CREATIVE_FIELDS_PLAIN });
        for (const [id, a] of Object.entries(d as Record<string, any>)) got[id] = toCreative(a);
      },
    ];
    for (const run of attempts) {
      try {
        await run();
        if (Object.keys(got).length) break;
      } catch (e: any) {
        error = e?.message || String(e);
        console.error('Meta Ads creatives', cfg.accountId, error);
      }
    }
    if (Object.keys(got).length) {
      error = null;
      cache.set(key, { data: got, until: Date.now() + 60 * 60000 });
    }
    Object.assign(out, got);
  }
  return { creatives: out, error };
}

// ---------- ad preview (how the ad looks, video playable) ----------

export const PREVIEW_FORMATS = ['MOBILE_FEED_STANDARD', 'INSTAGRAM_STANDARD', 'INSTAGRAM_STORY'] as const;
export type PreviewFormat = (typeof PREVIEW_FORMATS)[number];

// Meta returns an <iframe> snippet; only its src (a facebook.com preview page) is passed to the browser.
export async function adPreview(cfg: AdsConfig, adId: string, format: PreviewFormat): Promise<{ src: string | null; video: string | null }> {
  if (!cfg.accountId || !/^\d{6,25}$/.test(adId)) throw new AdsError('Anuncio no válido.');
  return cached(`pv:${cfg.accountId}:${adId}:${format}`, 30 * 60000, async () => {
    // The ad must belong to the store's connected account.
    const ad = await graph(adId, cfg.token, { fields: 'account_id,creative{video_id}' });
    if (String(ad.account_id || '') !== cfg.accountId) throw new AdsError('Este anuncio no es de tu cuenta publicitaria.');
    let src: string | null = null;
    try {
      const d = await graph(`${adId}/previews`, cfg.token, { ad_format: format });
      const body = String(d?.data?.[0]?.body || '');
      const m = /src="([^"]+)"/.exec(body);
      const url = m ? m[1].replace(/&amp;/g, '&') : '';
      if (/^https:\/\/(www\.)?facebook\.com\//.test(url)) src = url;
    } catch (e: any) {
      console.error('Meta Ads preview', adId, format, e?.message || e);
    }
    let video: string | null = null;
    const vid = ad?.creative?.video_id;
    if (vid) {
      const v = await graph(String(vid), cfg.token, { fields: 'source' }).catch(() => null);
      if (v?.source && /^https:\/\//.test(v.source)) video = String(v.source);
    }
    return { src, video };
  });
}
