import { NextRequest, NextResponse } from 'next/server';
import { rawDb } from '@/lib/server/supabase';
import { addMember, createOrg, withSession } from '@/lib/server/accounts';
import { requirePlatformAdmin } from '@/lib/server/admin';
import { currentOrgId } from '@/lib/server/tenant';
import { updateSubscription, getSubscription } from '@/lib/server/billing';
import { fail, failFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Settings copied from the current store when asked (CRM presets, not data or connections).
const COPYABLE = ['wa_quick_replies', 'wa_tags', 'wa_auto', 'wa_agents'];

// New store for the platform owner (their own businesses): no charge, owner = the person creating it.
// Body: { name, copySettings? }. Signs in to the new store.
export async function POST(req: NextRequest) {
  try {
    const user = await requirePlatformAdmin();
    const from = await currentOrgId();
    const b = await req.json().catch(() => ({}));
    const name = String(b.name || '').trim().slice(0, 80);
    if (!name) return fail('Escribe el nombre de la tienda.');
    const orgId = await createOrg(name);
    await addMember(orgId, user.id, 'owner');
    await getSubscription(orgId); // creates the row
    await updateSubscription(orgId, { status: 'exempt', plan: 'escala' });
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
