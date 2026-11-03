import { NextRequest } from 'next/server';
import { updateIntegrations } from '@/lib/server/integrations';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { DropiError, dropiConfig, getProduct, type DropiLink } from '@/lib/server/dropi';
import { getLandingById } from '@/lib/server/db';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Link a landing to a Dropi product: { landingId, productId, variationId? }. The product is read from Dropi.
export async function PUT(req: NextRequest) {
  try {
    await requireManager();
    const cfg = await dropiConfig();
    if (!cfg) return fail('Conecta Dropi primero.', 400);
    const b = await req.json().catch(() => ({}));
    const landingId = String(b.landingId || '');
    if (!landingId || !(await getLandingById(landingId))) return fail('Landing no encontrada.', 404);
    const p = await getProduct(cfg, Number(b.productId));
    let variation: { id: number; name: string; salePrice: number | null } | null = null;
    if (p.type === 'VARIABLE') {
      variation = p.variations.find((v) => v.id === Number(b.variationId)) || null;
      if (!variation) return fail('Elige la variante (talla, color…) que se despacha.', 400);
    }
    const link: DropiLink = {
      productId: p.id,
      name: p.name,
      type: p.type,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      variationId: variation?.id ?? null,
      variationName: variation?.name ?? null,
      salePrice: variation?.salePrice ?? p.salePrice,
      image: p.image,
    };
    await updateIntegrations((s) => ({ ...s, dropi: { ...s.dropi!, links: { ...(s.dropi?.links || {}), [landingId]: link } } }));
    return ok({ link });
  } catch (e: any) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    if (e instanceof DropiError) return fail(e.message, 502);
    return failFrom(e);
  }
}

// Unlink: ?landingId=
export async function DELETE(req: NextRequest) {
  try {
    await requireManager();
    const landingId = String(req.nextUrl.searchParams.get('landingId') || '');
    await updateIntegrations((s) => {
      if (!s.dropi?.links?.[landingId]) return s;
      const links = { ...s.dropi.links };
      delete links[landingId];
      return { ...s, dropi: { ...s.dropi, links } };
    });
    return ok();
  } catch (e: any) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    return failFrom(e);
  }
}
