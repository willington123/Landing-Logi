import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { bookingSlugTaken, getAgenda, saveAgenda } from '@/lib/server/agenda';
import { currentOrgId } from '@/lib/server/tenant';
import { cleanAgenda } from '@/lib/agenda';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// The store's agenda: business type, services, professionals and reminder settings.
export async function GET() {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    return ok({ agenda: await getAgenda() });
  } catch (e) {
    return failFrom(e);
  }
}

// Only the owner or an admin change it. Body: the whole agenda (or { businessType } to switch type).
export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const clean = cleanAgenda({ ...(await getAgenda()), ...b });
    if (typeof clean === 'string') return fail(clean);
    if (clean.bookingSlug && (await bookingSlugTaken(clean.bookingSlug, await currentOrgId()))) return fail('Esa dirección de página de reservas ya la usa otro negocio. Elige otra.');
    await saveAgenda(clean);
    return ok({ agenda: clean });
  } catch (e) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    return failFrom(e);
  }
}
