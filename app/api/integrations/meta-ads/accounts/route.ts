import { adsConfig } from '@/lib/server/integrations';
import { AdsError, listAdAccounts } from '@/lib/server/meta-ads';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Ad accounts the connected Facebook user can read (to choose one).
export async function GET() {
  try {
    await requireManager();
    const cfg = await adsConfig();
    if (!cfg) return fail('Conecta con Facebook primero.', 400);
    return ok({ accounts: await listAdAccounts(cfg.token) });
  } catch (e: any) {
    return e instanceof Forbidden ? fail(e.message, 403) : e instanceof AdsError ? fail(e.message, 400) : failFrom(e);
  }
}
