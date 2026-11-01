import { NextRequest } from 'next/server';
import { randomInt } from 'crypto';
import { seal, updateIntegrations } from '@/lib/server/integrations';
import { phoneNumberInfo, GRAPH_VERSION } from '@/lib/server/whatsapp';
import { randomToken } from '@/lib/server/secrets';
import { Forbidden, assertNumberFree, graphGet, graphPost, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const env = (k: string) => (process.env[k] || '').trim();

// Finishes "Conectar con Facebook" (Meta Embedded Signup, for Tech Providers).
// Body: { code, phoneNumberId?, wabaId? } from the Facebook popup. If the popup's session message didn't arrive,
// the WhatsApp account comes from the token's granted assets and the number from that account.
// 1) exchanges the code for the store's business token, 2) subscribes the platform app to the store's
// WhatsApp account (its notices then reach /api/whatsapp/webhook), 3) registers the number for the Cloud API.
// The WhatsApp accounts the person shared (debug_token's granular scopes) and, in them, the one number to use.
async function numberFromGrant(token: string, appId: string, appSecret: string, wabaId: string): Promise<{ phoneNumberId: string; wabaId: string } | { error: string }> {
  let wabas = wabaId ? [wabaId] : [];
  if (!wabas.length) {
    const dbg = await graphGet(`debug_token?input_token=${encodeURIComponent(token)}`, `${appId}|${appSecret}`).catch(() => null);
    const scopes: any[] = dbg?.data?.granular_scopes || [];
    const ids = scopes.filter((g) => /^whatsapp_business_(management|messaging)$/.test(g.scope)).flatMap((g) => g.target_ids || []);
    wabas = Array.from(new Set(ids.map(String)));
  }
  if (!wabas.length) return { error: 'No elegiste ninguna cuenta de WhatsApp en la ventana de Facebook. Vuelve a intentarlo y termina todos los pasos.' };
  const numbers: { id: string; waba: string; phone: string }[] = [];
  for (const w of wabas.slice(0, 10)) {
    const list = await graphGet(`${w}/phone_numbers?fields=id,display_phone_number&limit=100`, token).catch(() => null);
    for (const n of list?.data || []) numbers.push({ id: String(n.id), waba: w, phone: String(n.display_phone_number || n.id) });
  }
  if (!numbers.length) return { error: 'La cuenta de WhatsApp que elegiste no tiene números. Agrega el número en la ventana de Facebook y vuelve a intentarlo.' };
  if (numbers.length > 1)
    return { error: `Facebook no indicó cuál número elegiste y esa cuenta tiene varios (${numbers.map((n) => n.phone).join(', ')}). Vuelve a intentarlo y termina todos los pasos de la ventana.` };
  return { phoneNumberId: numbers[0].id, wabaId: numbers[0].waba };
}

export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const appId = env('META_APP_ID');
    const appSecret = env('META_APP_SECRET');
    if (!appId || !appSecret || !env('META_ES_CONFIG_ID')) return fail('La conexión con Facebook aún no está habilitada en esta plataforma.', 503);
    const b = await req.json().catch(() => ({}));
    const code = String(b.code || '');
    let phoneNumberId = String(b.phoneNumberId || '').replace(/\D/g, '');
    let wabaId = String(b.wabaId || '').replace(/\D/g, '');
    if (!code) return fail('Facebook no devolvió la autorización. Vuelve a intentarlo.');

    const tokenRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`,
      { signal: AbortSignal.timeout(10000), cache: 'no-store' },
    );
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) return fail(`Meta no entregó el acceso: ${tokenData?.error?.message || `HTTP ${tokenRes.status}`}`, 502);
    const token = String(tokenData.access_token);

    if (!phoneNumberId) {
      const picked = await numberFromGrant(token, appId, appSecret, wabaId);
      if ('error' in picked) return fail(picked.error);
      phoneNumberId = picked.phoneNumberId;
      wabaId = picked.wabaId;
    }
    if (!wabaId) return fail('Facebook no devolvió la cuenta de WhatsApp. Vuelve a intentarlo y termina todos los pasos.');
    await assertNumberFree(phoneNumberId);

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
