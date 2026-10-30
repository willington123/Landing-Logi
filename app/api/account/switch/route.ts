import { NextRequest, NextResponse } from 'next/server';
import { getUser, roleIn, withSession } from '@/lib/server/accounts';
import { currentOrgId, sessionUserId } from '@/lib/server/tenant';
import { fail, failFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Switch to another store the person belongs to. Body: { orgId }.
export async function POST(req: NextRequest) {
  try {
    await currentOrgId(); // valid session
    const uid = sessionUserId()!;
    const { orgId } = await req.json().catch(() => ({}));
    if (typeof orgId !== 'string' || !(await roleIn(orgId, uid))) return fail('No perteneces a esa tienda.', 403);
    const user = await getUser(uid);
    if (!user) return fail('Usuario no encontrado.', 401);
    const res = await withSession(NextResponse.json({ success: true }), user, orgId);
    res.cookies.set('lp_last_org', orgId, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' });
    return res;
  } catch (e) {
    return failFrom(e);
  }
}
