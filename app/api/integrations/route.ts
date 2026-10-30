import { NextRequest } from 'next/server';
import { anthropicKey, capiConfig, storedIntegrations, vapiConfig, waConfig } from '@/lib/server/integrations';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { decrypt, mask } from '@/lib/server/secrets';
import { getWebhookHealth } from '@/lib/server/wa-store';
import { publicBaseUrl } from '@/lib/server/vapi';
import { failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const env = (k: string) => (process.env[k] || '').trim();

// The current store's connections. Keys are never returned, only a masked hint.
export async function GET(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    const role = await currentRole();
    const manager = role === 'owner' || role === 'admin';
    const base = publicBaseUrl(req.nextUrl.origin);
    const [s, wa, vapi, capi, claude, health] = await Promise.all([
      storedIntegrations(orgId),
      waConfig(orgId),
      vapiConfig(orgId),
      capiConfig(orgId),
      anthropicKey(orgId),
      getWebhookHealth().catch(() => null),
    ]);
    const manual = wa?.mode === 'manual';
    return ok({
      canManage: manager,
      embedded: {
        // "Conectar con Facebook" appears when the platform's Meta app is set up for Embedded Signup.
        available: Boolean(env('META_APP_ID') && env('META_APP_SECRET') && env('META_ES_CONFIG_ID')),
        appId: env('META_APP_ID') || null,
        configId: env('META_ES_CONFIG_ID') || null,
        graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
      },
      whatsapp: wa
        ? {
            connected: true,
            source: wa.source,
            mode: wa.mode,
            phoneNumberId: wa.phoneNumberId,
            wabaId: wa.wabaId,
            displayPhone: wa.displayPhone,
            confirmTemplate: wa.confirmTemplate,
            templateLang: wa.templateLang,
            token: mask(wa.token),
            appSecretSet: Boolean(wa.appSecret),
            // What to paste in the store's own Meta app (manual mode).
            webhookUrl: manual ? `${base}/api/whatsapp/webhook/${orgId}` : `${base}/api/whatsapp/webhook`,
            verifyToken: manual && manager ? wa.verifyToken : null,
            health,
          }
        : { connected: false, webhookUrl: `${base}/api/whatsapp/webhook/${orgId}` },
      vapi: vapi
        ? { connected: true, source: vapi.source, phoneNumberId: vapi.phoneNumberId, apiKey: mask(vapi.apiKey), webhookSecretSet: Boolean(vapi.webhookSecret) }
        : { connected: false },
      capi: capi ? { connected: true, source: capi.source, token: mask(capi.token), testCode: capi.testCode } : { connected: false },
      anthropic: claude
        ? { connected: true, source: claude.source, apiKey: claude.source === 'plan' ? null : mask(claude.key), left: claude.left ?? null }
        : { connected: false },
      saved: { whatsapp: Boolean(s.whatsapp), vapi: Boolean(s.vapi), capi: Boolean(s.capi), anthropic: Boolean(s.anthropic && decrypt(s.anthropic.apiKey)) },
    });
  } catch (e) {
    return failFrom(e);
  }
}
