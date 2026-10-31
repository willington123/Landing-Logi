import { NextRequest } from 'next/server';
import { adsConfig, seal, updateIntegrations } from '@/lib/server/integrations';
import { AdsError, adAccount, cleanAccountId, forgetAdsCache } from '@/lib/server/meta-ads';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const handle = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e instanceof AdsError || e?.userFacing ? fail(e.message, 400) : failFrom(e));

// Connect Meta Ads. Body: { token, accountId } (pasted token) or { accountId } (choose an account after "Conectar con Facebook").
export async function PUT(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const accountId = cleanAccountId(b.accountId);
    if (!accountId) return fail('Escribe el id de la cuenta publicitaria (lo ves en el Administrador de anuncios).');
    const pasted = String(b.token || '').trim();
    const current = await adsConfig();
    const token = pasted || current?.token;
    if (!token) return fail('Conecta con Facebook o pega un token de acceso.');
    const acc = await adAccount(token, accountId); // checks the token can read this account
    await updateIntegrations((s) => ({
      ...s,
      metaAds: {
        token: pasted ? seal(pasted) : s.metaAds!.token,
        accountId: acc.id,
        accountName: acc.name,
        currency: acc.currency || null,
        mode: pasted ? 'manual' : s.metaAds?.mode || 'oauth',
        expiresAt: pasted ? null : s.metaAds?.expiresAt || null,
        connectedAt: new Date().toISOString(),
      },
    }));
    forgetAdsCache();
    return ok({ account: acc });
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
