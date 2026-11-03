import { NextRequest, NextResponse } from 'next/server';
import { rawDb } from '@/lib/server/supabase';
import { addMember, createOrg, withSession } from '@/lib/server/accounts';
import { getUser } from '@/lib/server/accounts';
import { isPlatformAdmin } from '@/lib/server/billing';
import { currentOrgId, sessionUserId } from '@/lib/server/tenant';
import { updateSubscription, getSubscription } from '@/lib/server/billing';
import { fail, failFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Settings copied from the current store when asked (CRM presets, not data or connections).
const COPYABLE = ['wa_quick_replies', 'wa_tags', 'wa_auto', 'wa_agents'];

// New store, owned by the person creating it. Body: { name, copySettings? }. Signs in to the new store.
// The platform owner's stores (their own businesses) are free; anyone else's start with the free trial and,
// after their first store, pay the plan's "tienda extra" price.
export async function POST(req: NextRequest) {
  try {
    const from = await currentOrgId();
    const user = await getUser(sessionUserId()!);
    if (!user) return fail('Tu sesión ya no es válida.', 401);
    const admin = isPlatformAdmin(user.email);
    if (!admin) {
      const { count } = await rawDb().from('memberships').select('org_id', { count: 'exact', head: true }).eq('user_id', user.id).eq('role', 'owner');
      if ((count || 0) >= 50) return fail('Llegaste a 50 tiendas. Escríbenos para un plan a la medida.', 400);
    }
    const b = await req.json().catch(() => ({}));
    const name = String(b.name || '').trim().slice(0, 80);
    if (!name) return fail('Escribe el nombre de la tienda.');
    const orgId = await createOrg(name);
    await addMember(orgId, user.id, 'owner');
    await getSubscription(orgId); // creates the row (free trial)
    if (admin) await updateSubscription(orgId, { status: 'exempt', plan: 'escala' });
    if (b.copySettings) {
      const { data } = await rawDb().from('settings').select('id, data').eq('org_id', from).in('id', COPYABLE);
      if (data?.length) await rawDb().from('settings').upsert(data.map((r) => ({ org_id: orgId, id: r.id, data: r.data })));
    }
    const res = await withSession(NextResponse.json({ success: true, orgId }), user, orgId);
    res.cookies.set('lp_last_org', orgId, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' });
    return res;
  } catch (e: any) {
    return e?.status === 403 ? fail(e.message, 403) : failFrom(e);
  }
}
