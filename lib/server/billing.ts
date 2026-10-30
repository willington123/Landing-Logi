// Plans, subscriptions, usage limits and payments (Wompi). Server-only. Platform-wide tables, so rawDb().
import { createHash, randomBytes } from 'crypto';
import { rawDb } from '@/lib/server/supabase';
import { MAIN_ORG } from '@/lib/server/constants';
import { DEFAULT_PLANS, GRACE_DAYS, TRIAL_AI_REPLIES, TRIAL_DAYS, TRIAL_PLAN, type Plan, type PlanId, type SubStatus } from '@/lib/plans';

const env = (k: string) => (process.env[k] || '').trim();
const DAY = 86400000;

// ---------- plans ----------

let plansCache: { plans: Plan[]; until: number } | null = null;
export async function getPlans(): Promise<Plan[]> {
  if (plansCache && plansCache.until > Date.now()) return plansCache.plans;
  const { data } = await rawDb().from('platform_settings').select('data').eq('id', 'plans').maybeSingle();
  const saved = (data?.data as { plans?: Plan[] })?.plans;
  const plans = Array.isArray(saved) && saved.length === DEFAULT_PLANS.length ? saved : DEFAULT_PLANS;
  plansCache = { plans, until: Date.now() + 30_000 };
  return plans;
}
export async function savePlans(plans: Plan[]) {
  const { error } = await rawDb().from('platform_settings').upsert({ id: 'plans', data: { plans } });
  if (error) throw new Error(error.message);
  plansCache = null;
}
export async function planById(id: string): Promise<Plan> {
  const plans = await getPlans();
  return plans.find((p) => p.id === id) || plans.find((p) => p.id === TRIAL_PLAN)!;
}

// ---------- subscriptions ----------

export interface SubRow {
  org_id: string;
  plan: PlanId;
  status: SubStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  auto_renew: boolean;
  payment_source_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  customer_email: string | null;
  retries: number;
  next_retry_at: string | null;
  canceled_at: string | null;
}

export interface Subscription extends SubRow {
  effective: SubStatus; // the status right now (a trial or period that ended reads 'expired')
  accessEndsAt: string | null;
  daysLeft: number | null;
  panelLocked: boolean; // only the Plan page works
  landingsOff: boolean; // public landings stop (after the grace days)
  planInfo: Plan;
}

export async function startTrial(orgId: string) {
  const { error } = await rawDb()
    .from('subscriptions')
    .upsert({ org_id: orgId, plan: TRIAL_PLAN, status: 'trialing', trial_ends_at: new Date(Date.now() + TRIAL_DAYS * DAY).toISOString() }, { onConflict: 'org_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export function computeSub(row: SubRow, plan: Plan, now = Date.now()): Subscription {
  const ends = row.status === 'trialing' ? row.trial_ends_at : row.current_period_end;
  const endMs = ends ? new Date(ends).getTime() : null;
  let effective: SubStatus = row.status;
  if (row.status !== 'exempt' && (endMs === null || endMs <= now)) effective = 'expired';
  const locked = effective === 'expired';
  return {
    ...row,
    effective,
    accessEndsAt: ends,
    daysLeft: endMs === null ? null : Math.max(0, Math.ceil((endMs - now) / DAY)),
    panelLocked: locked,
    landingsOff: locked && (endMs === null || now > endMs + GRACE_DAYS * DAY),
    planInfo: plan,
  };
}

// Stores without a row (created before plans existed): the main store is exempt, others get a trial.
export async function getSubscription(orgId: string): Promise<Subscription> {
  let { data } = await rawDb().from('subscriptions').select('*').eq('org_id', orgId).maybeSingle();
  if (!data) {
    if (orgId === MAIN_ORG) await rawDb().from('subscriptions').upsert({ org_id: orgId, plan: 'escala', status: 'exempt' }, { onConflict: 'org_id', ignoreDuplicates: true });
    else await startTrial(orgId);
    ({ data } = await rawDb().from('subscriptions').select('*').eq('org_id', orgId).maybeSingle());
  }
  const row = data as SubRow;
  return computeSub(row, await planById(row.plan));
}

export async function updateSubscription(orgId: string, patch: Partial<SubRow>) {
  const { error } = await rawDb().from('subscriptions').update({ ...patch, updated_at: new Date().toISOString() }).eq('org_id', orgId);
  if (error) throw new Error(error.message);
  forgetAccess(orgId);
}

// Quick check used on every panel request and public landing (cached briefly).
const accessCache = new Map<string, { locked: boolean; landingsOff: boolean; until: number }>();
export function forgetAccess(orgId?: string) {
  if (orgId) accessCache.delete(orgId);
  else accessCache.clear();
}
export async function access(orgId: string): Promise<{ locked: boolean; landingsOff: boolean }> {
  const hit = accessCache.get(orgId);
  if (hit && hit.until > Date.now()) return hit;
  let res = { locked: false, landingsOff: false };
  try {
    const s = await getSubscription(orgId);
    res = { locked: s.panelLocked, landingsOff: s.landingsOff };
  } catch (e: any) {
    // Plans not set up yet (migration not run): never lock anyone out.
    if (!/subscriptions|platform_settings|does not exist|schema cache/i.test(String(e?.message))) throw e;
  }
  accessCache.set(orgId, { ...res, until: Date.now() + 10_000 });
  return res;
}

// ---------- usage and limits ----------

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};
const monthKey = () => new Date().toISOString().slice(0, 7);

export async function usage(orgId: string) {
  const count = async (table: string, f: (q: any) => any) => {
    const { count: n } = await f(rawDb().from(table).select('*', { count: 'exact', head: true }));
    return n || 0;
  };
  const [landings, orders, members, ai] = await Promise.all([
    count('landings', (q) => q.eq('org_id', orgId)),
    count('orders', (q) => q.eq('org_id', orgId).gte('created_at', monthStart())),
    count('memberships', (q) => q.eq('org_id', orgId)),
    aiUsed(orgId),
  ]);
  return { landings, ordersThisMonth: orders, members, aiReplies: ai };
}

async function aiUsed(orgId: string): Promise<number> {
  const { data } = await rawDb().from('settings').select('data').eq('org_id', orgId).eq('id', 'usage').maybeSingle();
  const u = data?.data as { month?: string; aiReplies?: number } | undefined;
  return u?.month === monthKey() ? u.aiReplies || 0 : 0;
}

export async function addAiReply(orgId: string) {
  const used = await aiUsed(orgId);
  await rawDb().from('settings').upsert({ org_id: orgId, id: 'usage', data: { month: monthKey(), aiReplies: used + 1 } });
}

// Replies the store may still send this month with the platform's Claude key.
export async function aiRepliesLeft(orgId: string): Promise<number> {
  const s = await getSubscription(orgId).catch(() => null);
  if (!s || s.panelLocked) return 0;
  const included = s.effective === 'exempt' ? 0 : s.effective === 'trialing' ? TRIAL_AI_REPLIES : s.planInfo.aiReplies;
  return Math.max(0, included - (await aiUsed(orgId)));
}

export class LimitError extends Error {
  status = 402;
}

export async function assertCanAddLanding(orgId: string) {
  const s = await getSubscription(orgId);
  if (s.effective === 'exempt' || s.planInfo.landings === null) return;
  const { landings } = await usage(orgId);
  if (landings >= s.planInfo.landings) throw new LimitError(`Tu plan ${s.planInfo.name} permite ${s.planInfo.landings} landings. Mejora tu plan en Plan y pagos para crear más.`);
}

export async function assertCanAddMember(orgId: string) {
  const s = await getSubscription(orgId);
  if (s.effective === 'exempt' || s.planInfo.members === null) return;
  const { members } = await usage(orgId);
  if (members >= s.planInfo.members) throw new LimitError(`Tu plan ${s.planInfo.name} permite ${s.planInfo.members} personas. Mejora tu plan en Plan y pagos para agregar más.`);
}

// ---------- Wompi ----------

export function wompiConfigured() {
  return Boolean(env('WOMPI_PUBLIC_KEY') && env('WOMPI_PRIVATE_KEY') && env('WOMPI_INTEGRITY_SECRET') && env('WOMPI_EVENTS_SECRET'));
}
const wompiApi = () => env('WOMPI_API_URL') || (env('WOMPI_PUBLIC_KEY').startsWith('pub_prod_') ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1');

async function wompi(path: string, init: RequestInit & { auth?: 'public' | 'private' } = {}) {
  const key = init.auth === 'public' ? env('WOMPI_PUBLIC_KEY') : env('WOMPI_PRIVATE_KEY');
  const res = await fetch(`${wompiApi()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msgs = data?.error?.messages ? Object.values(data.error.messages).flat().join('; ') : '';
    throw new Error(`Wompi: ${msgs || data?.error?.reason || data?.error?.type || `HTTP ${res.status}`}`);
  }
  return data;
}

// Integrity signature Wompi requires on every payment: SHA256(reference + amount + currency + integrity secret).
export const integrity = (reference: string, amountCents: number, currency = 'COP') =>
  createHash('sha256').update(`${reference}${amountCents}${currency}${env('WOMPI_INTEGRITY_SECRET')}`).digest('hex');

// Hosted checkout (card, PSE, Nequi, Bancolombia). Wompi sends the customer back to redirectUrl?id=<transaction>.
export function checkoutUrl(p: { reference: string; amountCents: number; email?: string | null; redirectUrl: string }) {
  const q = new URLSearchParams({
    'public-key': env('WOMPI_PUBLIC_KEY'),
    currency: 'COP',
    'amount-in-cents': String(p.amountCents),
    reference: p.reference,
    'signature:integrity': integrity(p.reference, p.amountCents),
    'redirect-url': p.redirectUrl,
  });
  if (p.email) q.set('customer-data:email', p.email);
  return `${env('WOMPI_CHECKOUT_URL') || 'https://checkout.wompi.co/p/'}?${q.toString()}`;
}

export async function acceptanceTokens() {
  const d = await wompi(`/merchants/${env('WOMPI_PUBLIC_KEY')}`, { auth: 'public' });
  return {
    acceptance: d?.data?.presigned_acceptance as { acceptance_token: string; permalink: string } | undefined,
    personal: d?.data?.presigned_personal_data_auth as { acceptance_token: string; permalink: string } | undefined,
  };
}

export async function getTransaction(id: string) {
  const d = await wompi(`/transactions/${encodeURIComponent(id)}`);
  return d.data as WompiTx;
}

export interface WompiTx {
  id: string;
  reference: string;
  status: string; // PENDING | APPROVED | DECLINED | VOIDED | ERROR
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
  status_message?: string;
}

// Webhook check: SHA256 of the values listed in signature.properties + timestamp + events secret.
export function validEvent(body: any): boolean {
  const props: string[] = body?.signature?.properties || [];
  const checksum = String(body?.signature?.checksum || '');
  if (!props.length || !checksum || !env('WOMPI_EVENTS_SECRET')) return false;
  const value = (path: string) => path.split('.').reduce((o: any, k) => (o == null ? o : o[k]), body?.data);
  const raw = props.map((p) => String(value(p) ?? '')).join('') + String(body?.timestamp ?? '') + env('WOMPI_EVENTS_SECRET');
  return createHash('sha256').update(raw).digest('hex').toUpperCase() === checksum.toUpperCase();
}

// ---------- payments ----------

const newRef = (orgId: string) => `LP-${orgId.replace(/^org_/, '').slice(0, 10)}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase();

export async function createPayment(orgId: string, planId: PlanId, kind: 'checkout' | 'auto' | 'manual', months = 1) {
  const plan = await planById(planId);
  const row = {
    id: `pay_${randomBytes(9).toString('base64url')}`,
    org_id: orgId,
    plan: plan.id,
    amount_cents: plan.price * 100 * months,
    currency: 'COP',
    reference: newRef(orgId),
    status: 'PENDING',
    kind,
    months,
  };
  const { error } = await rawDb().from('payments').insert(row);
  if (error) throw new Error(error.message);
  return row;
}

// Records a Wompi transaction on its payment and, when approved, extends the subscription (only once).
export async function applyTransaction(tx: WompiTx): Promise<{ applied: boolean; status: string; orgId?: string }> {
  const { data: pay } = await rawDb().from('payments').select('*').eq('reference', tx.reference).maybeSingle();
  if (!pay) return { applied: false, status: 'unknown_reference' };
  if (Number(tx.amount_in_cents) !== Number(pay.amount_cents) || (tx.currency || 'COP') !== pay.currency) {
    await rawDb().from('payments').update({ status: 'ERROR', error: 'El monto no coincide.', wompi_id: tx.id, updated_at: new Date().toISOString() }).eq('id', pay.id);
    return { applied: false, status: 'amount_mismatch', orgId: pay.org_id };
  }
  // Already applied: a late or repeated notice never changes it again.
  if (pay.applied_at) return { applied: false, status: pay.status, orgId: pay.org_id };
  const now = new Date().toISOString();
  await rawDb()
    .from('payments')
    .update({ status: tx.status, wompi_id: tx.id, method: tx.payment_method_type || null, error: tx.status === 'APPROVED' ? null : tx.status_message || null, updated_at: now })
    .eq('id', pay.id);

  if (tx.status === 'APPROVED' && !pay.applied_at) {
    // Claim the payment first so a webhook and a redirect can't both extend the subscription.
    const { data: claimed } = await rawDb().from('payments').update({ applied_at: now }).eq('id', pay.id).is('applied_at', null).select('id');
    if (!claimed?.length) return { applied: false, status: tx.status, orgId: pay.org_id };
    await extendPeriod(pay.org_id, pay.plan, pay.months || 1);
    return { applied: true, status: tx.status, orgId: pay.org_id };
  }
  if (['DECLINED', 'ERROR', 'VOIDED'].includes(tx.status) && pay.kind === 'auto') {
    const sub = await getSubscription(pay.org_id);
    // A first charge that fails (e.g. during the trial) only turns the automatic charge off.
    if (!['active', 'past_due'].includes(sub.status)) {
      await updateSubscription(pay.org_id, { auto_renew: false });
      return { applied: false, status: tx.status, orgId: pay.org_id };
    }
    const retries = (sub.retries || 0) + 1;
    await updateSubscription(pay.org_id, { status: 'past_due', retries, next_retry_at: retries >= 3 ? null : new Date(Date.now() + DAY).toISOString(), ...(retries >= 3 ? { auto_renew: false } : {}) });
  }
  return { applied: false, status: tx.status, orgId: pay.org_id };
}

export async function extendPeriod(orgId: string, planId: string, months = 1) {
  const sub = await getSubscription(orgId);
  // Paid time left (or trial days left) is kept: the new month starts when it ends.
  const left = ['active', 'past_due', 'trialing'].includes(sub.effective) && sub.accessEndsAt ? new Date(sub.accessEndsAt) : null;
  const base = left && left.getTime() > Date.now() ? left : new Date();
  const end = new Date(base);
  end.setMonth(end.getMonth() + months);
  await updateSubscription(orgId, { plan: planId as PlanId, status: sub.status === 'exempt' ? 'exempt' : 'active', current_period_end: end.toISOString(), retries: 0, next_retry_at: null });
}

// Monthly automatic charges with the saved card (and a check of payments still pending). Runs with the scheduled tasks.
export async function processBilling() {
  const out = { charged: 0, checked: 0, errors: [] as string[] };
  if (!wompiConfigured()) return out;
  const soon = new Date(Date.now() + DAY).toISOString();
  const { data: due } = await rawDb()
    .from('subscriptions')
    .select('*')
    .eq('auto_renew', true)
    .in('status', ['active', 'past_due'])
    .lte('current_period_end', soon)
    .limit(100);
  for (const s of (due || []) as SubRow[]) {
    if (!s.payment_source_id || (s.next_retry_at && new Date(s.next_retry_at).getTime() > Date.now())) continue;
    // Never two automatic charges in flight for the same store.
    const { data: pending } = await rawDb().from('payments').select('id').eq('org_id', s.org_id).eq('kind', 'auto').eq('status', 'PENDING').limit(1);
    if (pending?.length) continue;
    try {
      const pay = await createPayment(s.org_id, s.plan, 'auto');
      const tx = await chargeCard({ sourceId: s.payment_source_id, amountCents: pay.amount_cents, reference: pay.reference, email: s.customer_email || '' });
      await applyTransaction(tx);
      out.charged++;
    } catch (e: any) {
      out.errors.push(`${s.org_id}: ${e?.message || e}`);
      await updateSubscription(s.org_id, { status: 'past_due', retries: (s.retries || 0) + 1, next_retry_at: new Date(Date.now() + DAY).toISOString() }).catch(() => {});
    }
  }
  // Payments Wompi hasn't confirmed by webhook: ask for them (older than 2 minutes, last 3 days).
  const { data: pend } = await rawDb()
    .from('payments')
    .select('id, wompi_id')
    .eq('status', 'PENDING')
    .lte('created_at', new Date(Date.now() - 120000).toISOString())
    .gte('created_at', new Date(Date.now() - 3 * DAY).toISOString())
    .limit(50);
  for (const p of pend || []) {
    if (!p.wompi_id) continue;
    try {
      await applyTransaction(await getTransaction(p.wompi_id));
      out.checked++;
    } catch (e: any) {
      out.errors.push(`${p.id}: ${e?.message || e}`);
    }
  }
  return out;
}

// Saves a card (tokenized in the browser) for automatic monthly charges.
export async function savePaymentSource(p: { token: string; email: string; acceptanceToken: string; personalToken?: string }) {
  const d = await wompi('/payment_sources', {
    method: 'POST',
    body: JSON.stringify({ type: 'CARD', token: p.token, customer_email: p.email, acceptance_token: p.acceptanceToken, ...(p.personalToken ? { accept_personal_auth: p.personalToken } : {}) }),
  });
  return { id: String(d.data.id), brand: d.data?.public_data?.brand || null, last4: d.data?.public_data?.last_four || null };
}

export async function chargeCard(p: { sourceId: string; amountCents: number; reference: string; email: string }): Promise<WompiTx> {
  const d = await wompi('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      amount_in_cents: p.amountCents,
      currency: 'COP',
      signature: integrity(p.reference, p.amountCents),
      customer_email: p.email,
      payment_method: { installments: 1 },
      reference: p.reference,
      payment_source_id: Number(p.sourceId),
      recurrent: true,
    }),
  });
  await rawDb().from('payments').update({ wompi_id: String(d.data.id), updated_at: new Date().toISOString() }).eq('reference', p.reference);
  return d.data as WompiTx;
}

// ---------- platform admin ----------

export function isPlatformAdmin(email: string | null | undefined) {
  const list = env('PLATFORM_ADMIN_EMAILS')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && list.includes(email.toLowerCase()));
}
