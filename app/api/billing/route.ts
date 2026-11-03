import { rawDb } from '@/lib/server/supabase';
import { aiCredits, aiRepliesLeft, firstStoreOf, getPlans, getSubscription, usage, wompiConfigured } from '@/lib/server/billing';
import { AI_PACK, PREPAY, extraStoreAi } from '@/lib/plans';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// The store's plan, usage this month, available plans and payment history.
export async function GET() {
  try {
    const orgId = await currentOrgId();
    const role = await currentRole();
    const [sub, plans, use, first, credits, aiLeft, { data: payments }] = await Promise.all([
      getSubscription(orgId),
      getPlans(),
      usage(orgId),
      firstStoreOf(orgId),
      aiCredits(orgId),
      aiRepliesLeft(orgId),
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
      // This store's price: the plan's for the owner's first store, the "tienda extra" one for the others.
      extraStore: first !== orgId
        ? { firstStoreName: ((await rawDb().from('organizations').select('name').eq('id', first).maybeSingle()).data?.name as string) || 'tu primera tienda' }
        : null,
      prices: plans.map((p) => ({ id: p.id, monthly: first !== orgId ? p.extraStorePrice : p.price, aiReplies: first !== orgId ? extraStoreAi(p) : p.aiReplies })),
      prepay: PREPAY,
      aiPack: AI_PACK,
      ai: { credits, left: aiLeft },
      usage: use,
      payments: payments || [],
      wompi: { configured: wompiConfigured(), publicKey: pub || null, sandbox: !pub.startsWith('pub_prod_'), apiUrl: (process.env.WOMPI_API_URL || '').trim() || null },
    });
  } catch (e) {
    return failFrom(e);
  }
}
