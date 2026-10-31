import { NextRequest } from 'next/server';
import { sessionUserId } from '@/lib/server/tenant';
import { updateIntegrations } from '@/lib/server/integrations';
import { phoneNumberInfo } from '@/lib/server/whatsapp';
import { randomToken } from '@/lib/server/secrets';
import { Forbidden, assertNumberFree, graphGet, graphPost, requireManager } from '@/lib/server/integrations-api';
import { SourceError, sourceCredentials } from '@/lib/server/wa-portfolio';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Connect this store's WhatsApp with a number of the same portfolio, reusing another store's token and
// app secret. Body: { from, wabaId, phoneNumberId }.
export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const phoneNumberId = String(b.phoneNumberId || '').replace(/\D/g, '');
    const wabaId = String(b.wabaId || '').replace(/\D/g, '');
    if (!phoneNumberId || !wabaId) return fail('Elige un número.');
    const src = await sourceCredentials(sessionUserId()!, String(b.from || ''));
    if (!src.sealedSecret) return fail('A esa tienda le falta la clave secreta de la app. Vuelve a conectarla allá.');
    await assertNumberFree(phoneNumberId);
    // The number must really be in that WhatsApp account, reachable with this token.
    const list = await graphGet(`${wabaId}/phone_numbers?fields=id&limit=100`, src.token).catch(() => null);
    if (!list?.data?.some((n: any) => String(n.id) === phoneNumberId)) return fail('Ese número no está en esa cuenta de WhatsApp o el token no lo puede usar.');
    const info = await phoneNumberInfo({ token: src.token, phoneNumberId });
    if (!info.ok) return fail(`Meta no aceptó el número: ${info.error}`, 400);
    await graphPost(`${wabaId}/subscribed_apps`, src.token, {}).catch(() => {});
    const saved = await updateIntegrations((s) => ({
      ...s,
      whatsapp: {
        mode: 'manual',
        phoneNumberId,
        wabaId,
        displayPhone: info.info.display_phone_number || null,
        token: src.sealedToken,
        appSecret: src.sealedSecret,
        verifyToken: s.whatsapp?.verifyToken || randomToken(),
        confirmTemplate: s.whatsapp?.confirmTemplate || null,
        templateLang: s.whatsapp?.templateLang || 'es',
        connectedAt: new Date().toISOString(),
      },
    }));
    return ok({ displayPhone: saved.whatsapp?.displayPhone, verifiedName: info.info.verified_name || null });
  } catch (e: any) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    if (e instanceof SourceError || e?.userFacing) return fail(e.message, 400);
    return failFrom(e);
  }
}
