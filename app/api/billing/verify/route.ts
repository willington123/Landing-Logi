import { NextRequest } from 'next/server';
import { rawDb } from '@/lib/server/supabase';
import { applyTransaction, getTransaction } from '@/lib/server/billing';
import { currentOrgId } from '@/lib/server/tenant';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Back from Wompi (/plan?id=<transaction>): checks the transaction with Wompi and applies it. Body: { id }.
export async function POST(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    const { id } = await req.json().catch(() => ({}));
    if (!/^[\w-]{4,80}$/.test(String(id || ''))) return fail('Transacción no válida.');
    const tx = await getTransaction(String(id));
    const { data: pay } = await rawDb().from('payments').select('org_id').eq('reference', tx.reference).maybeSingle();
    if (!pay || pay.org_id !== orgId) return fail('Este pago no es de tu tienda.', 404);
    const r = await applyTransaction(tx);
    return ok({ status: tx.status, applied: r.applied, message: tx.status_message || null });
  } catch (e) {
    return failFrom(e);
  }
}
