import { NextRequest } from 'next/server';
import { checkoutUrl, createPayment, getPlans, wompiConfigured } from '@/lib/server/billing';
import { PREPAY } from '@/lib/plans';
import { requireBillingManager } from '@/lib/server/billing-api';
import { getUser } from '@/lib/server/accounts';
import { sessionUserId } from '@/lib/server/tenant';
import { publicBaseUrl } from '@/lib/server/vapi';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Pay a plan on Wompi's page (card, PSE, Nequi, Bancolombia). Body: { plan, months? } (1, 3, 6 or 12, with discount).
export async function POST(req: NextRequest) {
  try {
    const orgId = await requireBillingManager();
    if (!wompiConfigured()) return fail('Los pagos aún no están habilitados. Escríbenos para activar tu plan.', 503);
    const { plan, months } = await req.json().catch(() => ({}));
    if (!(await getPlans()).some((p) => p.id === plan)) return fail('Plan no válido.');
    const m = PREPAY.some((x) => x.months === Number(months)) ? Number(months) : 1;
    const pay = await createPayment(orgId, plan, 'checkout', m);
    const me = await getUser(sessionUserId()!);
    const url = checkoutUrl({ reference: pay.reference, amountCents: pay.amount_cents, email: me?.email, redirectUrl: `${publicBaseUrl(req.nextUrl.origin)}/plan` });
    return ok({ url, reference: pay.reference });
  } catch (e: any) {
    return e?.status === 403 ? fail(e.message, 403) : failFrom(e);
  }
}
