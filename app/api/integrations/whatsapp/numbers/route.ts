import { NextRequest } from 'next/server';
import { sessionUserId } from '@/lib/server/tenant';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { SourceError, portfolioNumbers, sourceCredentials, waSources } from '@/lib/server/wa-portfolio';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Without ?from: the person's other stores whose WhatsApp connection can be reused.
// With ?from=<store>: the WhatsApp accounts and numbers of that store's portfolio.
export async function GET(req: NextRequest) {
  try {
    const orgId = await requireManager();
    const uid = sessionUserId()!;
    const from = req.nextUrl.searchParams.get('from');
    if (!from) return ok({ sources: await waSources(uid, orgId) });
    const src = await sourceCredentials(uid, from);
    return ok(await portfolioNumbers(uid, src.token, src.wabaId));
  } catch (e: any) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    if (e instanceof SourceError) return fail(e.message, 400);
    return failFrom(e);
  }
}
