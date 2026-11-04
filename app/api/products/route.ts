import { NextRequest } from 'next/server';
import { cleanProduct, productAsLanding } from '@/lib/products';
import { deleteProduct, getProducts, saveProduct, sellables } from '@/lib/server/products';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { currentOrgId } from '@/lib/server/tenant';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const handle = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e?.userFacing ? fail(e.message, 400) : failFrom(e));

// The store's WhatsApp products, and everything that can be sold (landings + products) for "Nuevo pedido".
export async function GET() {
  try {
    await currentOrgId();
    const [products, all] = await Promise.all([getProducts(), sellables()]);
    return ok({
      products,
      sellables: all.map((l) => ({
        id: l.id,
        name: l.productName || l.title,
        kind: l.kind === 'product' ? 'product' : 'landing',
        image: l.mainImage || null,
        country: l.country || 'Colombia',
        offers: (l.combos || []).filter((c) => c.promoPrice > 0).map((c) => ({ units: c.units, name: c.name, price: c.promoPrice })),
      })),
    });
  } catch (e) {
    return handle(e);
  }
}

// Create or edit a product: { product }
export async function PUT(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const p = cleanProduct(b.product);
    if (typeof p === 'string') return fail(p, 400);
    const saved = await saveProduct(p);
    return ok({ product: saved, asLanding: productAsLanding(saved).id });
  } catch (e) {
    return handle(e);
  }
}

// ?id=
export async function DELETE(req: NextRequest) {
  try {
    await requireManager();
    await deleteProduct(String(req.nextUrl.searchParams.get('id') || ''));
    return ok();
  } catch (e) {
    return handle(e);
  }
}
