import { NextRequest } from 'next/server';
import { getPlans, savePlans } from '@/lib/server/billing';
import { requirePlatformAdmin } from '@/lib/server/admin';
import { cleanPlans } from '@/lib/plans';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Edit the plans' names, prices and limits. Body: { plans }.
export async function PUT(req: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { plans } = await req.json().catch(() => ({}));
    const clean = cleanPlans(plans);
    if (typeof clean === 'string') return fail(clean);
    await savePlans(clean);
    return ok({ plans: await getPlans() });
  } catch (e: any) {
    return e?.status === 403 ? fail(e.message, 403) : failFrom(e);
  }
}
