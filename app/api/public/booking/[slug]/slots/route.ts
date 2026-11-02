import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { runWithOrg } from '@/lib/server/tenant';
import { availability, findBookingPage } from '@/lib/server/agenda';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Free times on a day: ?serviceId=…&date=YYYY-MM-DD[&staffId=…]. Only times, never who booked.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const page = await findBookingPage(params.slug);
    if (!page) return fail('Esta página de reservas no existe o está apagada.', 404);
    const q = req.nextUrl.searchParams;
    const date = q.get('date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Fecha inválida.');
    const slots = await runWithOrg(page.orgId, () => availability(page.agenda, q.get('serviceId') || '', date, q.get('staffId') || undefined));
    return ok({ slots: slots.map((s) => ({ time: s.time, staffId: s.staffId })) });
  } catch (e) {
    return failFrom(e);
  }
}
