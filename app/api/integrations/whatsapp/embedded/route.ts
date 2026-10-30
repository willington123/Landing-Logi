import { NextRequest } from 'next/server';
import { randomInt } from 'crypto';
import { seal, updateIntegrations } from '@/lib/server/integrations';
import { phoneNumberInfo, GRAPH_VERSION } from '@/lib/server/whatsapp';
import { randomToken } from '@/lib/server/secrets';
import { Forbidden, graphPost, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const env = (k: string) => (process.env[k] || '').trim();

// Finishes "Conectar con Facebook" (Meta Embedded Signup, for Tech Providers).
// Body: { code, phoneNumberId, wabaId } from the Facebook popup.
// 1) exchanges the code for the store's business token, 2) subscribes the platform app to the store's
// WhatsApp account (its notices then reach /api/whatsapp/webhook), 3) registers the number for the Cloud API.
export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const appId = env('META_APP_ID');
    const appSecret = env('META_APP_SECRET');
    if (!appId || !appSecret || !env('META_ES_CONFIG_ID')) return fail('La conexión con Facebook aún no está habilitada en esta plataforma.', 503);
    const b = await req.json().catch(() => ({}));
    const code = String(b.code || '');
    const phoneNumberId = String(b.phoneNumberId || '').replace(/\D/g, '');
    const wabaId = String(b.wabaId || '').replace(/\D/g, '');
    if (!code || !phoneNumberId || !wabaId) return fail('Facebook no devolvió los datos de la cuenta. Vuelve a intentarlo.');

    const tokenRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`,
      { signal: AbortSignal.timeout(10000), cache: 'no-store' },
    );
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) return fail(`Meta no entregó el acceso: ${tokenData?.error?.message || `HTTP ${tokenRes.status}`}`, 502);
    const token = String(tokenData.access_token);

    await graphPost(`${wabaId}/subscribed_apps`, token, {});
    // Registering an already registered number fails harmlessly.
    await graphPost(`${phoneNumberId}/register`, token, { messaging_product: 'whatsapp', pin: String(randomInt(100000, 999999)) }).catch((e) => {
      if (!/already registered|registrad/i.test(e.message)) throw e;
    });
    const info = await phoneNumberInfo({ token, phoneNumberId });
    await updateIntegrations((s) => ({
      ...s,
      whatsapp: {
        mode: 'embedded',
        phoneNumberId,
        wabaId,
        displayPhone: info.ok ? info.info.display_phone_number || null : null,
        token: seal(token),
        appSecret: null,
        verifyToken: s.whatsapp?.verifyToken || randomToken(),
        confirmTemplate: s.whatsapp?.confirmTemplate || null,
        templateLang: s.whatsapp?.templateLang || 'es',
        connectedAt: new Date().toISOString(),
      },
    }));
    return ok({ displayPhone: info.ok ? info.info.display_phone_number : null });
  } catch (e: any) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    if (e?.status === 401) return failFrom(e);
    return fail(`No se pudo terminar la conexión: ${e?.message || e}`, 502);
  }
}
