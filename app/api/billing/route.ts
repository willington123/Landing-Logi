import { rawDb } from '@/lib/server/supabase';
import { getPlans, getSubscription, usage, wompiConfigured } from '@/lib/server/billing';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// The store's plan, usage this month, available plans and payment history.
export async function GET() {
  try {
    const orgId = await currentOrgId();
    const role = await currentRole();
    const [sub, plans, use, { data: payments }] = await Promise.all([
      getSubscription(orgId),
      getPlans(),
      usage(orgId),
      rawDb().from('payments').select('id, plan, amount_cents, currency, reference, status, method, kind, created_at, applied_at, error').eq('org_id', orgId).order('created_at', { ascending: false }).limit(24),
    ]);
    const pub = (process.env.WOMPI_PUBLIC_KEY || '').trim();
    return ok({
      canManage: role === 'owner' || role === 'admin',
      subscription: {
        plan: sub.plan,
        status: sub.status,
        effective: sub.effective,
        accessEndsAt: sub.accessEndsAt,
        daysLeft: sub.daysLeft,
        panelLocked: sub.panelLocked,
        landingsOff: sub.landingsOff,
        autoRenew: sub.auto_renew,
        card: sub.card_last4 ? { brand: sub.card_brand, last4: sub.card_last4 } : null,
        retries: sub.retries,
      },
      plans,
      usage: use,
      payments: payments || [],
      wompi: { configured: wompiConfigured(), publicKey: pub || null, sandbox: !pub.startsWith('pub_prod_'), apiUrl: (process.env.WOMPI_API_URL || '').trim() || null },
    });
  } catch (e) {
    return failFrom(e);
  }
}
