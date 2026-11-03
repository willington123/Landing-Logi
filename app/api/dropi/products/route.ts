import { NextRequest } from 'next/server';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { DropiError, dropiConfig, searchProducts } from '@/lib/server/dropi';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Dropi catalog search: ?q=name or product id
export async function GET(req: NextRequest) {
  try {
    await requireManager();
    const cfg = await dropiConfig();
    if (!cfg) return fail('Conecta Dropi primero.', 400);
    const q = String(req.nextUrl.searchParams.get('q') || '').slice(0, 80);
    const page = Math.max(0, Math.min(50, Number(req.nextUrl.searchParams.get('page')) || 0));
    return ok({ products: await searchProducts(cfg.token, q, page) });
  } catch (e: any) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    if (e instanceof DropiError) return fail(e.message, 502);
    return failFrom(e);
  }
}
