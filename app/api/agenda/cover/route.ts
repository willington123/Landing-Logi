import { NextRequest } from 'next/server';
import { cloudEnabled, uploadPublicImage } from '@/lib/server/db';
import { currentOrgId } from '@/lib/server/tenant';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Cover photo of the booking page. Body: { image: data URL }. Returns its public URL.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    await requireManager();
    const { image } = await req.json().catch(() => ({}));
    return ok({ url: await uploadPublicImage(`booking-${await currentOrgId()}`, String(image || '')) });
  } catch (e: any) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    if (e?.userFacing) return fail(e.message);
    return failFrom(e);
  }
}
