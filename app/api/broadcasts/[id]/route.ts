import { currentOrgId } from '@/lib/server/tenant';
import { requireManager } from '@/lib/server/integrations-api';
import { deleteBroadcast, getBroadcast } from '@/lib/server/broadcasts';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await currentOrgId();
    const b = await getBroadcast(params.id);
    return b ? ok({ broadcast: b }) : fail('Ese envío ya no existe.', 404);
  } catch (e) {
    return failFrom(e);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await requireManager();
    await deleteBroadcast(params.id);
    return ok({});
  } catch (e) {
    return failFrom(e);
  }
}
