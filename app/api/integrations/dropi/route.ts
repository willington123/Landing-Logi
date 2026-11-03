import { NextRequest } from 'next/server';
import { seal, storedIntegrations, updateIntegrations } from '@/lib/server/integrations';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { DropiError, checkToken, cleanDomain, cleanToken } from '@/lib/server/dropi';
import { publicBaseUrl } from '@/lib/server/vapi';
import { listLandings } from '@/lib/server/db';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { decrypt, mask } from '@/lib/server/secrets';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const handle = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e instanceof DropiError ? fail(e.message, 400) : failFrom(e));

const hostOf = (req: NextRequest) => cleanDomain(publicBaseUrl(req.nextUrl.origin)) || '';

// Dropi of the current store: connected, auto-send, and each landing with its linked product.
export async function GET(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    const role = await currentRole();
    const s = (await storedIntegrations(orgId)).dropi;
    const token = s ? decrypt(s.token) : '';
    const landings = await listLandings().catch(() => []);
    return ok({
      canManage: role === 'owner' || role === 'admin',
      connected: Boolean(token),
      token: token ? mask(token) : null,
      autoSend: Boolean(s?.autoSend),
      domain: s?.domain || null,
      suggestedDomain: hostOf(req),
      landings: landings.map((l) => ({ id: l.id, name: l.productName || l.title, image: l.mainImage || null, link: s?.links?.[l.id] || null })),
    });
  } catch (e) {
    return handle(e);
  }
}

// { token } connects (checked with Dropi first); { autoSend } turns sending on confirm on or off.
export async function PUT(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const token = cleanToken(String(b.token ?? '')).slice(0, 2000);
    if (token) {
      // With the store's domain first (what Dropi asks to name the store after), then the token alone.
      const domain = cleanDomain(String(b.domain ?? '')) || hostOf(req);
      let used: string | null = domain || null;
      const help = (e: any) =>
        e instanceof DropiError && e.denied
          ? new DropiError(
              `${e.message} Revisa: 1) que copiaste el token de la tienda (Dropi → Mis Integraciones), completo; 2) que la tienda en Dropi se llame exactamente ${domain || 'como tu dominio'}. Si sigue igual, pregúntale a Dropi si debe habilitar la conexión por API.`,
            )
          : e;
      try {
        await checkToken({ token, domain: used });
      } catch (e: any) {
        if (!(e instanceof DropiError && e.denied && used)) throw help(e);
        used = null;
        await checkToken({ token }).catch((e2: any) => {
          throw help(e2);
        });
      }
      await updateIntegrations((s) => ({ ...s, dropi: { token: seal(token), domain: used, autoSend: b.autoSend !== undefined ? Boolean(b.autoSend) : (s.dropi?.autoSend ?? false), links: s.dropi?.links || {}, connectedAt: new Date().toISOString() } }));
      return ok();
    }
    if (b.autoSend !== undefined) {
      const cur = await updateIntegrations((s) => (s.dropi ? { ...s, dropi: { ...s.dropi, autoSend: Boolean(b.autoSend) } } : s));
      if (!cur.dropi) return fail('Conecta Dropi primero.', 400);
      return ok();
    }
    return fail('Pega el token de tu tienda en Dropi.', 400);
  } catch (e) {
    return handle(e);
  }
}

// Disconnect (product links are kept for when it is connected again).
export async function DELETE() {
  try {
    await requireManager();
    await updateIntegrations((s) => (s.dropi ? { ...s, dropi: { ...s.dropi, token: '' } } : s));
    return ok();
  } catch (e) {
    return handle(e);
  }
}
