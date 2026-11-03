import { NextRequest } from 'next/server';
import { seal, storedIntegrations, updateIntegrations } from '@/lib/server/integrations';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { DropiError, checkToken, cleanToken } from '@/lib/server/dropi';
import { listLandings } from '@/lib/server/db';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { decrypt, mask } from '@/lib/server/secrets';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const handle = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e instanceof DropiError ? fail(e.message, 400) : failFrom(e));

// Dropi of the current store: connected, auto-send, and each landing with its linked product.
export async function GET() {
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
      await checkToken(token);
      await updateIntegrations((s) => ({ ...s, dropi: { token: seal(token), autoSend: b.autoSend !== undefined ? Boolean(b.autoSend) : (s.dropi?.autoSend ?? false), links: s.dropi?.links || {}, connectedAt: new Date().toISOString() } }));
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
