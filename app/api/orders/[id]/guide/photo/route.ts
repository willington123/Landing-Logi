import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { cloudEnabled, publicFileUrl, signedUpload } from '@/lib/server/db';
import { currentOrgId } from '@/lib/server/tenant';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Photo of the shipping label for the "guía" notice: a one-time link the browser uploads it to. Body: { mime, size }.
// The file is public (WhatsApp downloads it from its link when sending).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const org = await currentOrgId();
    if (!/^[\w-]{1,80}$/.test(params.id)) return fail('Pedido no válido.');
    const b = await req.json().catch(() => ({}));
    const mime = String(b.mime || '').toLowerCase();
    if (mime !== 'image/jpeg' && mime !== 'image/png') return fail('La foto debe ser JPG o PNG.');
    if (!(Number(b.size) > 0) || Number(b.size) > 5 * 1024 * 1024) return fail('La foto debe pesar menos de 5 MB.');
    const up = await signedUpload(`guides/${org}/${params.id}-${randomUUID().replace(/-/g, '').slice(0, 12)}.${mime === 'image/png' ? 'png' : 'jpg'}`);
    return ok({ ...up, url: publicFileUrl(up.path) });
  } catch (e) {
    return failFrom(e);
  }
}
