import { NextRequest } from 'next/server';
import { seal, updateIntegrations, waConfig } from '@/lib/server/integrations';
import { phoneNumberInfo } from '@/lib/server/whatsapp';
import { randomToken } from '@/lib/server/secrets';
import { Forbidden, assertNumberFree, checkAnthropic, checkVapi, graphGet, graphPost, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const clean = (v: unknown, max = 400) => String(v ?? '').trim().slice(0, max);
const KINDS = ['whatsapp', 'vapi', 'capi', 'anthropic'] as const;
type Kind = (typeof KINDS)[number];

function handleError(e: any) {
  if (e instanceof Forbidden) return fail(e.message, 403);
  if (e?.userFacing) return fail(e.message, 400);
  return failFrom(e);
}
const userError = (msg: string) => Object.assign(new Error(msg), { userFacing: true });

// Connect (or update) one integration of the current store. Keys are checked with the provider before saving.
export async function PUT(req: NextRequest, { params }: { params: { kind: string } }) {
  const kind = params.kind as Kind;
  if (!KINDS.includes(kind)) return fail('Integración desconocida.', 404);
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));

    if (kind === 'whatsapp') {
      // Only the confirmation template (keeps the connection).
      if (!b.token && (b.confirmTemplate !== undefined || b.templateLang !== undefined)) {
        const current = await waConfig();
        if (!current) throw userError('Conecta WhatsApp primero.');
        if (current.source === 'env') throw userError('Esta tienda usa el WhatsApp configurado en Vercel: la plantilla se cambia con WHATSAPP_CONFIRM_TEMPLATE.');
        await updateIntegrations((s) => ({ ...s, whatsapp: { ...s.whatsapp!, confirmTemplate: clean(b.confirmTemplate, 120) || null, templateLang: clean(b.templateLang, 10) || 'es' } }));
        return ok();
      }
      const token = clean(b.token, 1000);
      const phoneNumberId = clean(b.phoneNumberId, 40).replace(/\D/g, '');
      const wabaId = clean(b.wabaId, 40).replace(/\D/g, '');
      const appSecret = clean(b.appSecret, 200);
      if (!token || !phoneNumberId) throw userError('Pega el token y el identificador del número.');
      if (!wabaId) throw userError('Pega el identificador de la cuenta de WhatsApp Business (WABA ID).');
      if (!appSecret) throw userError('Pega la clave secreta de tu app de Meta (Configuración de la app → Básica).');
      await assertNumberFree(phoneNumberId);
      const info = await phoneNumberInfo({ token, phoneNumberId });
      if (!info.ok) throw userError(`Meta no aceptó el token o el número: ${info.error}`);
      await graphGet(`${wabaId}/phone_numbers?limit=1`, token).catch((e) => {
        throw userError(`Meta no aceptó el WABA ID con este token: ${e.message}`);
      });
      // So Meta sends this WhatsApp account's messages to the app (harmless if it already does).
      await graphPost(`${wabaId}/subscribed_apps`, token, {}).catch(() => {});
      const saved = await updateIntegrations((s) => ({
        ...s,
        whatsapp: {
          mode: 'manual',
          phoneNumberId,
          wabaId,
          displayPhone: info.info.display_phone_number || null,
          token: seal(token),
          appSecret: seal(appSecret),
          verifyToken: s.whatsapp?.verifyToken || randomToken(),
          confirmTemplate: clean(b.confirmTemplate, 120) || s.whatsapp?.confirmTemplate || null,
          templateLang: clean(b.templateLang, 10) || s.whatsapp?.templateLang || 'es',
          connectedAt: new Date().toISOString(),
        },
      }));
      return ok({ displayPhone: saved.whatsapp?.displayPhone, verifiedName: info.info.verified_name || null });
    }

    if (kind === 'vapi') {
      const apiKey = clean(b.apiKey, 200);
      const phoneNumberId = clean(b.phoneNumberId, 80);
      if (!apiKey || !phoneNumberId) throw userError('Pega la clave privada y el ID del número de Vapi.');
      const n = await checkVapi(apiKey, phoneNumberId).catch((e) => {
        throw userError(e.message);
      });
      await updateIntegrations((s) => ({ ...s, vapi: { apiKey: seal(apiKey), phoneNumberId, webhookSecret: s.vapi?.webhookSecret || randomToken(24), connectedAt: new Date().toISOString() } }));
      return ok({ number: n.number || null });
    }

    if (kind === 'capi') {
      const token = clean(b.token, 1000);
      if (!token) throw userError('Pega el token de acceso de la API de conversiones.');
      await graphGet('me?fields=id', token).catch(() => {
        throw userError('Meta no aceptó el token. Genéralo en Events Manager → tu píxel → Configuración → API de conversiones.');
      });
      await updateIntegrations((s) => ({ ...s, capi: { token: seal(token), testCode: clean(b.testCode, 40) || null, connectedAt: new Date().toISOString() } }));
      return ok();
    }

    // anthropic
    const apiKey = clean(b.apiKey, 300);
    if (!apiKey.startsWith('sk-ant-')) throw userError('La clave de Anthropic empieza por sk-ant-. Créala en console.anthropic.com → API Keys.');
    await checkAnthropic(apiKey).catch((e) => {
      throw userError(e.message);
    });
    await updateIntegrations((s) => ({ ...s, anthropic: { apiKey: seal(apiKey), connectedAt: new Date().toISOString() } }));
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

// Disconnect one integration (the store goes back to the keys in Vercel only if it is the main store).
export async function DELETE(_req: NextRequest, { params }: { params: { kind: string } }) {
  const kind = params.kind as Kind;
  if (!KINDS.includes(kind)) return fail('Integración desconocida.', 404);
  try {
    await requireManager();
    await updateIntegrations((s) => {
      const next = { ...s };
      delete next[kind];
      return next;
    });
    return ok();
  } catch (e) {
    return handleError(e);
  }
}
