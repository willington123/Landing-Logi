import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { availability, getAgenda } from '@/lib/server/agenda';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Free start times: ?serviceId=…&date=2026-11-04[&staffId=…][&except=<appointment being moved>].
export async function GET(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const q = req.nextUrl.searchParams;
    const date = q.get('date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Fecha inválida.');
    const slots = await availability(await getAgenda(), q.get('serviceId') || '', date, q.get('staffId') || undefined, q.get('except') || undefined);
    return ok({ slots });
  } catch (e) {
    return failFrom(e);
  }
}
