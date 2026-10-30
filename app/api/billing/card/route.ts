import { NextRequest } from 'next/server';
import { acceptanceTokens, applyTransaction, chargeCard, createPayment, getPlans, getSubscription, savePaymentSource, updateSubscription, wompiConfigured } from '@/lib/server/billing';
import { requireBillingManager } from '@/lib/server/billing-api';
import { normalizeEmail, validEmail } from '@/lib/server/accounts';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Wompi's terms the customer must accept before saving a card (links shown next to the checkbox).
export async function GET() {
  try {
    await requireBillingManager();
    if (!wompiConfigured()) return fail('Los pagos aún no están habilitados.', 503);
    const t = await acceptanceTokens();
    return ok({
      acceptance: t.acceptance ? { token: t.acceptance.acceptance_token, permalink: t.acceptance.permalink } : null,
      personal: t.personal ? { token: t.personal.acceptance_token, permalink: t.personal.permalink } : null,
    });
  } catch (e: any) {
    return e?.status === 403 ? fail(e.message, 403) : failFrom(e);
  }
}

// Save a card (tokenized in the browser with Wompi's public key) for automatic monthly charges,
// and charge now if the store has no paid time left. Body: { plan, token, email, acceptanceToken, personalToken?, brand?, last4? }.
export async function POST(req: NextRequest) {
  try {
    const orgId = await requireBillingManager();
    if (!wompiConfigured()) return fail('Los pagos aún no están habilitados.', 503);
    const b = await req.json().catch(() => ({}));
    if (!(await getPlans()).some((p) => p.id === b.plan)) return fail('Plan no válido.');
    const email = normalizeEmail(b.email);
    if (!validEmail(email)) return fail('Escribe el correo para las facturas.');
    if (!/^tok_[\w-]+$/.test(String(b.token || ''))) return fail('No se pudo leer la tarjeta. Vuelve a escribirla.');
    if (!b.acceptanceToken) return fail('Acepta los términos de Wompi para guardar la tarjeta.');

    const source = await savePaymentSource({ token: b.token, email, acceptanceToken: String(b.acceptanceToken), personalToken: b.personalToken ? String(b.personalToken) : undefined });
    const sub = await getSubscription(orgId);
    const paidTimeLeft = sub.effective === 'active' && sub.daysLeft !== null && sub.daysLeft > 1;
    await updateSubscription(orgId, {
      payment_source_id: source.id,
      card_brand: source.brand || (b.brand ? String(b.brand).slice(0, 20) : null),
      card_last4: source.last4 || (b.last4 ? String(b.last4).replace(/\D/g, '').slice(-4) : null),
      customer_email: email,
      auto_renew: true,
      canceled_at: null,
      retries: 0,
      next_retry_at: null,
      // With paid time left, the new plan starts at the next charge.
      ...(paidTimeLeft ? { plan: b.plan } : {}),
    });
    if (paidTimeLeft) return ok({ charged: false, message: `Listo. El próximo cobro será al terminar tu periodo actual.` });

    const pay = await createPayment(orgId, b.plan, 'auto');
    const tx = await chargeCard({ sourceId: source.id, amountCents: pay.amount_cents, reference: pay.reference, email });
    const r = await applyTransaction(tx);
    return ok({ charged: true, status: tx.status, applied: r.applied, message: tx.status_message || null });
  } catch (e: any) {
    if (e?.status === 403) return fail(e.message, 403);
    if (/^Wompi:/.test(String(e?.message))) return fail(e.message, 502);
    return failFrom(e);
  }
}
