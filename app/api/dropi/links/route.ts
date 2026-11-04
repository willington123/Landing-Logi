import { NextRequest } from 'next/server';
import { updateIntegrations } from '@/lib/server/integrations';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { DropiError, dropiConfig, getProduct, type DropiLink } from '@/lib/server/dropi';
import { getLandingById } from '@/lib/server/db';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const saveLink = (landingId: string, link: DropiLink) =>
  updateIntegrations((s) => ({ ...s, dropi: { token: s.dropi?.token || '', autoSend: s.dropi?.autoSend ?? false, connectedAt: s.dropi?.connectedAt || new Date().toISOString(), ...s.dropi, links: { ...(s.dropi?.links || {}), [landingId]: link } } }));

// Link a landing to a Dropi product: { landingId, productId, variationId? }. With Dropi connected the product is
// read from Dropi; without it (or { manual: true }) the ids are saved as typed (for the Excel upload).
export async function PUT(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const landingId = String(b.landingId || '');
    if (!landingId || !(await getLandingById(landingId))) return fail('Landing no encontrada.', 404);
    const productId = Number(String(b.productId ?? '').replace(/\D/g, ''));
    if (!productId) return fail('Escribe el ID del producto en Dropi (el número que sale en el producto).', 400);
    const cfg = await dropiConfig();
    if (!cfg || b.manual) {
      const variationId = Number(String(b.variationId ?? '').replace(/\D/g, '')) || null;
      const link: DropiLink = {
        productId,
        name: String(b.name ?? '').trim().slice(0, 120) || `Producto ${productId}`,
        type: variationId ? 'VARIABLE' : 'SIMPLE',
        supplierId: null,
        supplierName: null,
        variationId,
        variationName: variationId ? `Variante ${variationId}` : null,
        salePrice: null,
        image: null,
      };
      await saveLink(landingId, link);
      return ok({ link });
    }
    const p = await getProduct(cfg, productId);
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
    await saveLink(landingId, link);
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
