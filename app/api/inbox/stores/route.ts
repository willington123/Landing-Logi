import { rawDb } from '@/lib/server/supabase';
import { userOrgs } from '@/lib/server/accounts';
import { currentOrgId, integrationsOrg, sessionUserId } from '@/lib/server/tenant';
import { failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const env = (k: string) => (process.env[k] || '').trim();

// Stores of the person signed in, with their WhatsApp number: for the "bandejas que ves" picker.
export async function GET() {
  try {
    const current = await currentOrgId();
    const orgs = await userOrgs(sessionUserId()!);
    const ids = orgs.map((o) => o.id);
    const { data } = ids.length ? await rawDb().from('settings').select('org_id, data').eq('id', 'integrations').in('org_id', ids) : { data: [] };
    const integ = Object.fromEntries((data || []).map((r) => [r.org_id, (r.data as any) || {}]));
    const stores = orgs.map((o) => {
      const wa = integ[o.id]?.whatsapp;
      const envWa = o.id === integrationsOrg() && Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'));
      return {
        id: o.id,
        name: o.name,
        phone: wa?.displayPhone || null,
        logo: o.logo || null,
        current: o.id === current,
        whatsapp: Boolean(wa?.phoneNumberId) || envWa,
      };
    });
    return ok({ stores });
  } catch (e) {
    return failFrom(e);
  }
}
