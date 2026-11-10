import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { rangeFromQuery } from '@/lib/server/ads-report';
import { profitReport, requireProfitAccess } from '@/lib/server/profit';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Rentabilidad of a period: ?range=7d|30d|month|… (&since&until for custom).
export async function GET(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    await requireProfitAccess();
    const { range, since, until } = rangeFromQuery(req.nextUrl.searchParams, 'month');
    return ok({ range, ...(await profitReport(since, until)) });
  } catch (e: any) {
    return failFrom(e);
  }
}
