import { NextRequest } from 'next/server';
import { currentOrgId } from '@/lib/server/tenant';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { DomainError, addDomain, domainsOf, removeDomain, setDomainLanding, vercelConnected } from '@/lib/server/domains';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const handle = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e instanceof DomainError ? fail(e.message, 400) : failFrom(e));

// The store's own domains, with their DNS status.
export async function GET() {
  try {
    const org = await currentOrgId();
    return ok({ domains: await domainsOf(org), vercel: vercelConnected() });
  } catch (e) {
    return handle(e);
  }
}

// Connect a domain. Body: { host }.
export async function POST(req: NextRequest) {
  try {
    const org = await requireManager();
    const b = await req.json().catch(() => ({}));
    return ok({ domain: await addDomain(org, String(b.host || '')) });
  } catch (e) {
    return handle(e);
  }
}

// The landing shown at the domain's root. Body: { host, landing: slug | null }.
export async function PATCH(req: NextRequest) {
  try {
    const org = await requireManager();
    const b = await req.json().catch(() => ({}));
    await setDomainLanding(org, String(b.host || ''), b.landing ? String(b.landing) : null);
    return ok();
  } catch (e) {
    return handle(e);
  }
}

// Disconnect (?host=).
export async function DELETE(req: NextRequest) {
  try {
    const org = await requireManager();
    await removeDomain(org, req.nextUrl.searchParams.get('host') || '');
    return ok();
  } catch (e) {
    return handle(e);
  }
}
