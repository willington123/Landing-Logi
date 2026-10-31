import { NextRequest } from 'next/server';
import { rawDb } from '@/lib/server/supabase';
import { addMember, createOrg, userOrgs } from '@/lib/server/accounts';
import { requirePlatformAdmin } from '@/lib/server/admin';
import { currentOrgId } from '@/lib/server/tenant';
import { getSubscription, updateSubscription } from '@/lib/server/billing';
import { adsConfig, forgetIntegrations, seal } from '@/lib/server/integrations';
import { AdsError, cleanAccountId, listAdAccounts } from '@/lib/server/meta-ads';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COPYABLE = ['wa_quick_replies', 'wa_tags', 'wa_auto', 'wa_agents'];

// One store per ad account (one product per ad account): each new store is named after the account,
// has no charge and comes with that ad account already connected (same Facebook connection).
// Body: { accountIds: string[], copySettings? }. Up to 50 per request.
export async function POST(req: NextRequest) {
  try {
    const user = await requirePlatformAdmin();
    const from = await currentOrgId();
    const b = await req.json().catch(() => ({}));
    const ids = Array.from(new Set((Array.isArray(b.accountIds) ? b.accountIds : []).map(cleanAccountId).filter(Boolean))) as string[];
    if (!ids.length) return fail('Marca al menos una cuenta publicitaria.');
    if (ids.length > 50) return fail('Máximo 50 tiendas a la vez.');
    const cfg = await adsConfig();
    if (!cfg) return fail('Conecta Meta Ads en esta tienda primero.');
    const readable = new Map((await listAdAccounts(cfg.token)).map((a) => [a.id, a]));

    // Accounts already used by one of the person's stores are skipped.
    const orgs = await userOrgs(user.id);
    const { data: integ } = await rawDb().from('settings').select('data').eq('id', 'integrations').in('org_id', orgs.map((o) => o.id));
    const used = new Set<string>();
    for (const r of integ || []) {
      const m = (r.data as any)?.metaAds;
      (m?.accounts?.length ? m.accounts.map((a: any) => a.id) : m?.accountId ? [m.accountId] : []).forEach((id: string) => used.add(id));
    }
    const { data: presets } = b.copySettings ? await rawDb().from('settings').select('id, data').eq('org_id', from).in('id', COPYABLE) : { data: [] as any[] };

    const created: { orgId: string; name: string; accountId: string }[] = [];
    const skipped: { accountId: string; reason: string }[] = [];
    for (const id of ids) {
      const acc = readable.get(id);
      if (!acc) {
        skipped.push({ accountId: id, reason: 'Tu conexión de Facebook no puede leer esta cuenta.' });
        continue;
      }
      if (used.has(id)) {
        skipped.push({ accountId: id, reason: 'Ya está en otra de tus tiendas.' });
        continue;
      }
      const orgId = await createOrg(acc.name || `Cuenta ${id}`);
      await addMember(orgId, user.id, 'owner');
      await getSubscription(orgId);
      await updateSubscription(orgId, { status: 'exempt', plan: 'escala' });
      const ref = { id: acc.id, name: acc.name, currency: acc.currency || null };
      const rows: { org_id: string; id: string; data: unknown }[] = [
        {
          org_id: orgId,
          id: 'integrations',
          data: { metaAds: { token: seal(cfg.token), accountId: ref.id, accountName: ref.name, currency: ref.currency, accounts: [ref], mode: cfg.mode, expiresAt: cfg.expiresAt, connectedAt: new Date().toISOString() } },
        },
        ...(presets || []).map((p) => ({ org_id: orgId, id: p.id, data: p.data })),
      ];
      const { error } = await rawDb().from('settings').upsert(rows);
      if (error) throw new Error(error.message);
      forgetIntegrations(orgId);
      used.add(id);
      created.push({ orgId, name: acc.name, accountId: id });
    }
    return ok({ created, skipped });
  } catch (e: any) {
    if (e?.status === 403) return fail(e.message, 403);
    if (e instanceof AdsError) return fail(e.message, 400);
    return failFrom(e);
  }
}
