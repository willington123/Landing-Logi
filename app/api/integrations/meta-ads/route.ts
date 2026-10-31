import { NextRequest } from 'next/server';
import { adsConfig, seal, updateIntegrations } from '@/lib/server/integrations';
import { AdsError, adAccount, cleanAccountId, forgetAdsCache } from '@/lib/server/meta-ads';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const handle = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e instanceof AdsError || e?.userFacing ? fail(e.message, 400) : failFrom(e));

// Connect Meta Ads. Body: { token?, accountIds: string[] } (or a single accountId). With a token it is a pasted
// token; without, it uses the "Conectar con Facebook" one already saved. Every account is checked with Meta.
export async function PUT(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const raw: unknown[] = Array.isArray(b.accountIds) ? b.accountIds : String(b.accountId || '').split(/[\s,;]+/);
    const ids = Array.from(new Set(raw.map(cleanAccountId).filter(Boolean))).slice(0, 25);
    if (!ids.length) return fail('Elige o escribe al menos una cuenta publicitaria (el id lo ves en el Administrador de anuncios).');
    const pasted = String(b.token || '').trim();
    const current = await adsConfig();
    const token = pasted || current?.token;
    if (!token) return fail('Conecta con Facebook o pega un token de acceso.');
    const accounts = [];
    for (const id of ids) {
      try {
        accounts.push(await adAccount(token, id));
      } catch (e: any) {
        if (e?.expired) throw e;
        return fail(`No se puede leer la cuenta ${id}: ${e?.message || e}`);
      }
    }
    const refs = accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency || null }));
    await updateIntegrations((s) => ({
      ...s,
      metaAds: {
        token: pasted ? seal(pasted) : s.metaAds!.token,
        accountId: refs[0].id,
        accountName: refs[0].name,
        currency: refs[0].currency,
        accounts: refs,
        mode: pasted ? 'manual' : s.metaAds?.mode || 'oauth',
        expiresAt: pasted ? null : s.metaAds?.expiresAt || null,
        connectedAt: new Date().toISOString(),
      },
    }));
    forgetAdsCache();
    return ok({ account: accounts[0], accounts });
  } catch (e) {
    return handle(e);
  }
}

export async function DELETE() {
  try {
    await requireManager();
    await updateIntegrations((s) => {
      const { metaAds, ...rest } = s;
      return rest;
    });
    forgetAdsCache();
    return ok();
  } catch (e) {
    return handle(e);
  }
}
