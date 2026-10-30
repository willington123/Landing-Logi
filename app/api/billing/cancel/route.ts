import { updateSubscription } from '@/lib/server/billing';
import { requireBillingManager } from '@/lib/server/billing-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Stop the automatic monthly charge. The plan keeps working until the end of the paid period.
export async function POST() {
  try {
    const orgId = await requireBillingManager();
    await updateSubscription(orgId, { auto_renew: false, canceled_at: new Date().toISOString() });
    return ok();
  } catch (e: any) {
    return e?.status === 403 ? fail(e.message, 403) : failFrom(e);
  }
}
