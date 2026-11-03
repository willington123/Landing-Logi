import { currentOrgId } from '@/lib/server/tenant';
import { sendOrderToDropi } from '@/lib/server/dropi-orders';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// "Enviar a Dropi": creates this order in Dropi (once; already sent → returns its Dropi number).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await currentOrgId();
    const r = await sendOrderToDropi(params.id);
    return r.ok ? ok({ dropiOrderId: r.dropiOrderId, already: Boolean(r.already) }) : fail(r.error, 400);
  } catch (e) {
    return failFrom(e);
  }
}
