import { NextRequest, NextResponse } from 'next/server';
import { clearFailures, passwordProblem, userOrgs, withSession } from '@/lib/server/accounts';
import { setPassword, userFromResetToken } from '@/lib/server/password-reset';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const EXPIRED = 'Este enlace ya se usó o venció. Pide uno nuevo.';

// Check a reset link before showing the form: ?t=<token>.
export async function GET(req: NextRequest) {
  try {
    const user = await userFromResetToken(req.nextUrl.searchParams.get('t'));
    if (!user) return fail(EXPIRED, 410);
    return ok({ email: user.email, name: user.name });
  } catch (e) {
    return failFrom(e);
  }
}

// Set the new password and sign in. Body: { token, password }.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const user = await userFromResetToken(body.token);
    if (!user) return fail(EXPIRED, 410);
    const problem = passwordProblem(body.password);
    if (problem) return fail(problem);
    const updated = await setPassword(user, String(body.password));
    clearFailures(user.email);
    const orgs = await userOrgs(user.id);
    if (!orgs.length) return NextResponse.json({ success: true, signedIn: false });
    const last = req.cookies.get('lp_last_org')?.value;
    const org = orgs.find((o) => o.id === last) || orgs[0];
    return withSession(NextResponse.json({ success: true, signedIn: true }), updated, org.id);
  } catch (e) {
    return failFrom(e);
  }
}
