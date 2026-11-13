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
    const extra = (req.nextUrl.searchParams.get('waba') || '').replace(/\D/g, '').slice(0, 30) || null;
    const res = await portfolioNumbers(uid, src.token, src.wabaId, extra);
    if (extra && !res.wabas.some((w) => w.id === extra))
      return fail(
        `Con esa conexión no se puede usar la cuenta ${extra}. Revisa que sea el identificador de la cuenta de WhatsApp (no el del número ni el del portafolio) y que esté asignada con control total al usuario del sistema de esa conexión; si la asignaste después de crear el token, genera un token nuevo.${res.extraError ? ` Meta respondió: ${res.extraError}` : ''}`,
      );
    return ok(res);
  } catch (e: any) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    if (e instanceof SourceError) return fail(e.message, 400);
    return failFrom(e);
  }
}
