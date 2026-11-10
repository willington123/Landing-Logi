import { NextRequest } from 'next/server';
import { cleanConfig } from '@/lib/profit';
import { getProfitConfig, requireProfitAccess, saveProfitConfig } from '@/lib/server/profit';
import { failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Costs used for the profit: delivery rate, freight, commissions, cost per product, campaign → product.
export async function PUT(req: NextRequest) {
  try {
    await requireProfitAccess();
    const b = await req.json().catch(() => ({}));
    const cur = await getProfitConfig();
    const next = cleanConfig({ ...cur, ...b });
    await saveProfitConfig(next);
    return ok({ config: next });
  } catch (e: any) {
    return failFrom(e);
  }
}
