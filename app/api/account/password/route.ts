import { NextRequest, NextResponse } from 'next/server';
import { changePassword, withSession } from '@/lib/server/accounts';
import { currentOrgId, sessionUserId } from '@/lib/server/tenant';
import { fail, failFrom } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Change your password. Other open sessions are closed. Body: { current, next }.
export async function POST(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    const { current, next } = await req.json().catch(() => ({}));
    const user = await changePassword(sessionUserId()!, String(current || ''), String(next || ''));
    return withSession(NextResponse.json({ success: true }), user, orgId);
  } catch (e: any) {
    if (/contraseña/i.test(String(e?.message))) return fail(e.message, 400);
    return failFrom(e);
  }
}
