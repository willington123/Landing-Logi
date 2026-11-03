import { NextRequest } from 'next/server';
import { checkoutUrl, createAiPackPayment, getSubscription, wompiConfigured } from '@/lib/server/billing';
import { requireBillingManager } from '@/lib/server/billing-api';
import { getUser } from '@/lib/server/accounts';
import { sessionUserId } from '@/lib/server/tenant';
import { publicBaseUrl } from '@/lib/server/vapi';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Buy a pack of extra AI replies on Wompi's page (they're added when the payment is approved and don't expire).
export async function POST(req: NextRequest) {
  try {
    const orgId = await requireBillingManager();
    if (!wompiConfigured()) return fail('Los pagos aún no están habilitados. Escríbenos para activar tu plan.', 503);
    const sub = await getSubscription(orgId);
    if (sub.effective !== 'active' && sub.effective !== 'past_due') return fail('Primero activa un plan; luego puedes sumar respuestas de IA.', 400);
    const pay = await createAiPackPayment(orgId);
    const me = await getUser(sessionUserId()!);
    const url = checkoutUrl({ reference: pay.reference, amountCents: pay.amount_cents, email: me?.email, redirectUrl: `${publicBaseUrl(req.nextUrl.origin)}/plan` });
    return ok({ url, reference: pay.reference });
  } catch (e: any) {
    return e?.status === 403 ? fail(e.message, 403) : failFrom(e);
  }
}
