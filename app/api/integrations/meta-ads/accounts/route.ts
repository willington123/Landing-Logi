import { rawDb } from '@/lib/server/supabase';
import { userOrgs } from '@/lib/server/accounts';
import { sessionUserId } from '@/lib/server/tenant';
import { adsConfig } from '@/lib/server/integrations';
import { AdsError, listAdAccounts } from '@/lib/server/meta-ads';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Ad accounts the connected Facebook user can read (to choose), with their portfolio and,
// if one is already used by another of the person's stores, which one.
export async function GET() {
  try {
    const orgId = await requireManager();
    const cfg = await adsConfig();
    if (!cfg) return fail('Conecta con Facebook primero.', 400);
    const [accounts, orgs] = await Promise.all([listAdAccounts(cfg.token), userOrgs(sessionUserId()!)]);
    const others = orgs.filter((o) => o.id !== orgId);
    const usedBy: Record<string, string> = {};
    if (others.length) {
      const { data } = await rawDb().from('settings').select('org_id, data').eq('id', 'integrations').in('org_id', others.map((o) => o.id));
      for (const r of data || []) {
        const m = (r.data as any)?.metaAds;
        const ids: string[] = m?.accounts?.length ? m.accounts.map((a: any) => a.id) : m?.accountId ? [m.accountId] : [];
        const name = others.find((o) => o.id === r.org_id)?.name || 'otra tienda';
        for (const id of ids) usedBy[id] = name;
      }
    }
    return ok({ accounts: accounts.map((a) => ({ ...a, usedBy: usedBy[a.id] || null })) });
  } catch (e: any) {
    return e instanceof Forbidden ? fail(e.message, 403) : e instanceof AdsError ? fail(e.message, 400) : failFrom(e);
  }
}
