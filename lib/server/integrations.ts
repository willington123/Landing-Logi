// Each store's connections (WhatsApp, Vapi, Meta Conversions API, Claude), saved per store in the
// "settings" table (row "integrations") with the keys encrypted. The store that owns the keys in Vercel
// (INTEGRATIONS_ORG_ID, the original store) keeps using them unless it saves its own.
import { db } from '@/lib/server/db';
import { rawDb } from '@/lib/server/supabase';
import { integrationsOrg, requestOrgSync } from '@/lib/server/tenant';
import { decrypt, encrypt } from '@/lib/server/secrets';
import { aiRepliesLeft } from '@/lib/server/billing';

const env = (k: string) => (process.env[k] || '').trim();

export interface WaConfig {
  source: 'env' | 'store';
  mode: 'env' | 'manual' | 'embedded';
  token: string;
  phoneNumberId: string;
  wabaId: string | null;
  appSecret: string | null; // signs the webhook notices (embedded signup uses the platform app's secret)
  verifyToken: string | null;
  confirmTemplate: string | null;
  templateLang: string;
  displayPhone: string | null;
}

export interface VapiConfig {
  source: 'env' | 'store';
  apiKey: string;
  phoneNumberId: string;
  webhookSecret: string | null;
}

// What is stored (secrets encrypted).
export interface StoredIntegrations {
  whatsapp?: {
    mode: 'manual' | 'embedded';
    phoneNumberId: string;
    wabaId?: string | null;
    displayPhone?: string | null;
    token: string; // encrypted
    appSecret?: string | null; // encrypted (manual mode)
    verifyToken: string;
    confirmTemplate?: string | null;
    templateLang?: string | null;
    connectedAt: string;
  };
  vapi?: { apiKey: string; phoneNumberId: string; webhookSecret: string; connectedAt: string };
  capi?: { token: string; testCode?: string | null; connectedAt: string };
  anthropic?: { apiKey: string; connectedAt: string };
  // Meta Ads (read-only): spend and creatives of the store's ad account. accountId null = signed in, account not chosen yet.
  metaAds?: {
    token: string;
    accountId: string | null; // first account (kept for older saves)
    accountName?: string | null;
    currency?: string | null;
    accounts?: AdAccountRef[]; // every ad account this store reads
    mode: 'oauth' | 'manual';
    expiresAt?: string | null;
    connectedAt: string;
  };
}

// ---------- reading (cached a few seconds per store) ----------

const cache = new Map<string, { data: StoredIntegrations; until: number }>();
const TTL = 10_000;

export function forgetIntegrations(orgId?: string) {
  if (orgId) cache.delete(orgId);
  else cache.clear();
}

async function stored(orgId: string): Promise<StoredIntegrations> {
  const hit = cache.get(orgId);
  if (hit && hit.until > Date.now()) return hit.data;
  const { data, error } = await rawDb().from('settings').select('data').eq('org_id', orgId).eq('id', 'integrations').maybeSingle();
  if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(error.message);
  const value = (data?.data as StoredIntegrations) || {};
  cache.set(orgId, { data: value, until: Date.now() + TTL });
  return value;
}

export async function storedIntegrations(orgId: string) {
  return stored(orgId);
}

const usesEnv = (orgId: string) => orgId === integrationsOrg();
const orgOrNull = (orgId?: string | null) => orgId ?? requestOrgSync();

export async function waConfig(orgId?: string | null): Promise<WaConfig | null> {
  const org = orgOrNull(orgId);
  if (!org) return null;
  const s = (await stored(org)).whatsapp;
  if (s) {
    const token = decrypt(s.token);
    if (!token || !s.phoneNumberId) return null;
    return {
      source: 'store',
      mode: s.mode,
      token,
      phoneNumberId: s.phoneNumberId,
      wabaId: s.wabaId || null,
      appSecret: s.mode === 'embedded' ? env('META_APP_SECRET') || null : decrypt(s.appSecret || null),
      verifyToken: s.verifyToken || null,
      confirmTemplate: s.confirmTemplate || null,
      templateLang: s.templateLang || 'es',
      displayPhone: s.displayPhone || null,
    };
  }
  if (usesEnv(org) && env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID')) {
    return {
      source: 'env',
      mode: 'env',
      token: env('WHATSAPP_TOKEN'),
      phoneNumberId: env('WHATSAPP_PHONE_NUMBER_ID'),
      wabaId: env('WHATSAPP_BUSINESS_ACCOUNT_ID') || null,
      appSecret: env('WHATSAPP_APP_SECRET') || null,
      verifyToken: env('WHATSAPP_VERIFY_TOKEN') || null,
      confirmTemplate: env('WHATSAPP_CONFIRM_TEMPLATE') || null,
      templateLang: env('WHATSAPP_TEMPLATE_LANG') || 'es',
      displayPhone: null,
    };
  }
  return null;
}

export async function vapiConfig(orgId?: string | null): Promise<VapiConfig | null> {
  const org = orgOrNull(orgId);
  if (!org) return null;
  const s = (await stored(org)).vapi;
  if (s) {
    const apiKey = decrypt(s.apiKey);
    return apiKey && s.phoneNumberId ? { source: 'store', apiKey, phoneNumberId: s.phoneNumberId, webhookSecret: s.webhookSecret || null } : null;
  }
  if (usesEnv(org) && env('VAPI_API_KEY') && env('VAPI_PHONE_NUMBER_ID')) {
    return { source: 'env', apiKey: env('VAPI_API_KEY'), phoneNumberId: env('VAPI_PHONE_NUMBER_ID'), webhookSecret: env('VAPI_WEBHOOK_SECRET') || null };
  }
  return null;
}

export async function capiConfig(orgId?: string | null): Promise<{ token: string; testCode: string | null; source: 'env' | 'store' } | null> {
  const org = orgOrNull(orgId);
  if (!org) return null;
  const s = (await stored(org)).capi;
  if (s) {
    const token = decrypt(s.token);
    return token ? { token, testCode: s.testCode || null, source: 'store' } : null;
  }
  if (usesEnv(org) && env('META_CAPI_ACCESS_TOKEN')) return { token: env('META_CAPI_ACCESS_TOKEN'), testCode: env('META_CAPI_TEST_CODE') || null, source: 'env' };
  return null;
}

// The store's own key; otherwise (other stores) the platform's key while the plan's included replies last.
export async function anthropicKey(orgId?: string | null): Promise<{ key: string; source: 'env' | 'store' | 'plan'; left?: number } | null> {
  const org = orgOrNull(orgId);
  if (!org) return null;
  const s = (await stored(org)).anthropic;
  if (s) {
    const key = decrypt(s.apiKey);
    return key ? { key, source: 'store' } : null;
  }
  if (usesEnv(org) && env('ANTHROPIC_API_KEY')) return { key: env('ANTHROPIC_API_KEY'), source: 'env' };
  if (env('ANTHROPIC_API_KEY')) {
    const left = await aiRepliesLeft(org).catch(() => 0);
    if (left > 0) return { key: env('ANTHROPIC_API_KEY'), source: 'plan', left };
  }
  return null;
}

// ---------- saving (current store) ----------

export async function updateIntegrations(mutate: (s: StoredIntegrations) => StoredIntegrations) {
  const d = await db();
  const current = await stored(d.orgId);
  const next = mutate({ ...current });
  const { error } = await d.from('settings').upsert({ id: 'integrations', data: next });
  if (error) throw new Error(error.message);
  forgetIntegrations(d.orgId);
  return next;
}

export const seal = (v: string) => encrypt(v.trim());

// ---------- routing incoming notices to their store ----------

// Store that owns a WhatsApp phone number id (the env number belongs to INTEGRATIONS_ORG_ID).
export async function orgForWhatsAppNumber(phoneNumberId: string): Promise<string | null> {
  if (!/^\d{1,30}$/.test(phoneNumberId || '')) return null;
  const { data } = await rawDb().from('settings').select('org_id').eq('id', 'integrations').eq('data->whatsapp->>phoneNumberId', phoneNumberId).limit(1);
  if (data?.[0]?.org_id) return data[0].org_id as string;
  if (env('WHATSAPP_PHONE_NUMBER_ID') === phoneNumberId) {
    // The env number, unless the main store replaced it with its own connection.
    const main = await stored(integrationsOrg());
    if (!main.whatsapp) return integrationsOrg();
  }
  return null;
}

// Stores with WhatsApp or Vapi connected (for the scheduled tasks).
export async function orgsWithConnections(): Promise<string[]> {
  const { data } = await rawDb().from('settings').select('org_id, data').eq('id', 'integrations');
  const out = new Set<string>([integrationsOrg()]);
  for (const r of data || []) if ((r.data as StoredIntegrations)?.whatsapp || (r.data as StoredIntegrations)?.vapi) out.add(r.org_id as string);
  return Array.from(out);
}

export interface AdAccountRef {
  id: string;
  name: string | null;
  currency: string | null;
}

export interface AdsConfig {
  token: string;
  accountId: string | null;
  accounts: AdAccountRef[];
  accountName: string | null;
  currency: string | null;
  mode: 'oauth' | 'manual';
  expiresAt: string | null;
}

export async function adsConfig(orgId?: string | null): Promise<AdsConfig | null> {
  const org = orgOrNull(orgId);
  if (!org) return null;
  const s = (await stored(org)).metaAds;
  if (!s) return null;
  const token = decrypt(s.token);
  if (!token) return null;
  const accounts: AdAccountRef[] = s.accounts?.length ? s.accounts : s.accountId ? [{ id: s.accountId, name: s.accountName || null, currency: s.currency || null }] : [];
  return { token, accountId: accounts[0]?.id || null, accounts, accountName: accounts[0]?.name || null, currency: accounts[0]?.currency || null, mode: s.mode, expiresAt: s.expiresAt || null };
}

// ---------- stores sharing a Meta app (one webhook URL per app) ----------

// App secret and verify token of the store that owns a WhatsApp number (manual connections only).
export async function waSecretsForNumber(phoneNumberId: string): Promise<{ orgId: string; appSecret: string | null } | null> {
  const org = await orgForWhatsAppNumber(phoneNumberId);
  if (!org) return null;
  const s = (await stored(org)).whatsapp;
  return { orgId: org, appSecret: s?.appSecret ? decrypt(s.appSecret) : null };
}

// Is this verify token one of a store's? (Meta checks the shared URL with it when that store's app is set up.)
export async function isStoreVerifyToken(token: string): Promise<boolean> {
  if (!token || token.length < 8) return false;
  const { data } = await rawDb().from('settings').select('org_id').eq('id', 'integrations').eq('data->whatsapp->>verifyToken', token).limit(1);
  return Boolean(data?.length);
}
