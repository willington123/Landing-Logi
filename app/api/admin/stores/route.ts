import { NextRequest } from 'next/server';
import { rawDb } from '@/lib/server/supabase';
import { computeSub, extendPeriod, getPlans, getSubscription, updateSubscription, type SubRow } from '@/lib/server/billing';
import { requirePlatformAdmin } from '@/lib/server/admin';
import { fail, failFrom, ok } from '@/lib/server/http';
import { randomBytes } from 'crypto';
import { getUser } from '@/lib/server/accounts';
import { resetToken } from '@/lib/server/password-reset';
import { emailConfigured } from '@/lib/server/email';
import { publicBaseUrl } from '@/lib/server/vapi';

export const dynamic = 'force-dynamic';

const handle = (e: any) => (e?.status === 403 ? fail(e.message, 403) : failFrom(e));

// Every store with its owner, plan, status and orders this month.
export async function GET() {
  try {
    await requirePlatformAdmin();
    const [plans, { data: orgs }, { data: subs }, { data: owners }] = await Promise.all([
      getPlans(),
      rawDb().from('organizations').select('id, name, created_at').order('created_at', { ascending: false }).limit(500),
      rawDb().from('subscriptions').select('*'),
      rawDb().from('memberships').select('org_id, user_id, role').eq('role', 'owner'),
    ]);
    const userIds = Array.from(new Set((owners || []).map((o) => o.user_id)));
    const { data: users } = userIds.length ? await rawDb().from('app_users').select('id, email, name').in('id', userIds) : { data: [] as any[] };
    const userById = Object.fromEntries((users || []).map((u) => [u.id, u]));
    const subByOrg: Record<string, SubRow> = Object.fromEntries((subs || []).map((s) => [s.org_id, s]));
    // Stores that never opened the panel since plans exist have no row yet: create it like the panel would.
    for (const o of orgs || []) if (!subByOrg[o.id]) subByOrg[o.id] = await getSubscription(o.id).catch(() => undefined as any);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const stores = await Promise.all(
      (orgs || []).map(async (o) => {
        const row = subByOrg[o.id] as SubRow | undefined;
        const sub = row ? computeSub(row, plans.find((p) => p.id === row.plan) || plans[1]) : null;
        const owner = (owners || []).find((m) => m.org_id === o.id);
        const { count } = await rawDb().from('orders').select('id', { count: 'exact', head: true }).eq('org_id', o.id).gte('created_at', monthStart);
        return {
          id: o.id,
          name: o.name,
          createdAt: o.created_at,
          owner: owner ? { email: userById[owner.user_id]?.email || '', name: userById[owner.user_id]?.name || null } : null,
          plan: sub?.plan || null,
          status: sub?.effective || null,
          accessEndsAt: sub?.accessEndsAt || null,
          autoRenew: Boolean(sub?.auto_renew),
          ordersThisMonth: count || 0,
        };
      }),
    );
    const mrr = stores.filter((s) => s.status === 'active').reduce((n, s) => n + (plans.find((p) => p.id === s.plan)?.price || 0), 0);
    return ok({ stores, plans, emailEnabled: emailConfigured(), summary: { total: stores.length, active: stores.filter((s) => s.status === 'active').length, trialing: stores.filter((s) => s.status === 'trialing').length, mrr } });
  } catch (e) {
    return handle(e);
  }
}

// Actions on one store. Body: { orgId, action: 'activate' (plan, months) | 'trial' (days) | 'exempt' | 'expire' }.
export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin();
    const b = await req.json().catch(() => ({}));
    const orgId = String(b.orgId || '');
    const { data: org } = await rawDb().from('organizations').select('id').eq('id', orgId).maybeSingle();
    if (!org) return fail('Tienda no encontrada.', 404);
    await getSubscription(orgId); // makes sure the row exists
    if (b.action === 'activate') {
      const plans = await getPlans();
      const plan = plans.find((p) => p.id === b.plan);
      const months = Math.min(12, Math.max(1, Math.round(Number(b.months) || 1)));
      if (!plan) return fail('Plan no válido.');
      // Recorded as a manual payment (e.g. bank transfer or Nequi) so it shows in the history.
      await rawDb().from('payments').insert({
        id: `pay_${randomBytes(9).toString('base64url')}`,
        org_id: orgId,
        plan: plan.id,
        amount_cents: plan.price * 100 * months,
        currency: 'COP',
        reference: `MANUAL-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase(),
        status: 'APPROVED',
        method: 'MANUAL',
        kind: 'manual',
        months,
        applied_at: new Date().toISOString(),
      });
      await extendPeriod(orgId, plan.id, months);
    } else if (b.action === 'reset_link') {
      // For an owner who can't receive emails: a 24-hour link to set a new password, shared by WhatsApp.
      const { data: owner } = await rawDb().from('memberships').select('user_id').eq('org_id', orgId).eq('role', 'owner').limit(1).maybeSingle();
      const user = owner ? await getUser(owner.user_id) : null;
      if (!user) return fail('Esta tienda no tiene dueño.', 404);
      return ok({ url: `${publicBaseUrl(req.nextUrl.origin)}/restablecer?t=${encodeURIComponent(resetToken(user, 24 * 3600000))}`, email: user.email });
    } else if (b.action === 'trial') {
      const days = Math.min(60, Math.max(1, Math.round(Number(b.days) || 7)));
      await updateSubscription(orgId, { status: 'trialing', trial_ends_at: new Date(Date.now() + days * 86400000).toISOString() });
    } else if (b.action === 'exempt') {
      await updateSubscription(orgId, { status: 'exempt', plan: 'escala' });
    } else if (b.action === 'expire') {
      await updateSubscription(orgId, { status: 'expired', auto_renew: false, current_period_end: new Date().toISOString(), trial_ends_at: new Date().toISOString() });
    } else return fail('Acción no válida.');
    return ok();
  } catch (e) {
    return handle(e);
  }
}
