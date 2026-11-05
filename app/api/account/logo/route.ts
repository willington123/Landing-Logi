import { NextRequest } from 'next/server';
import { db, uploadPublicImage } from '@/lib/server/db';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const manager = (r: string | null) => r === 'owner' || r === 'admin';

// The current store's logo: { image: dataURL } (JPG, PNG or WEBP, up to 3 MB). Owners and admins.
export async function POST(req: NextRequest) {
  try {
    const orgId = await currentOrgId();
    if (!manager(await currentRole())) return fail('Solo el dueño o un administrador pueden cambiar el logo.', 403);
    const { image } = await req.json().catch(() => ({}));
    if (typeof image !== 'string' || !image.startsWith('data:image/')) return fail('Elige una imagen JPG, PNG o WEBP.', 400);
    const url = await uploadPublicImage(`logos/${orgId}`, image);
    const { error } = await (await db()).from('settings').upsert({ id: 'store_logo', data: { url, updatedAt: new Date().toISOString() } });
    if (error) throw new Error(error.message);
    return ok({ url });
  } catch (e: any) {
    return e?.userFacing ? fail(e.message, 400) : failFrom(e);
  }
}

export async function DELETE() {
  try {
    await currentOrgId();
    if (!manager(await currentRole())) return fail('Solo el dueño o un administrador pueden cambiar el logo.', 403);
    const { error } = await (await db()).from('settings').delete().eq('id', 'store_logo');
    if (error) throw new Error(error.message);
    return ok();
  } catch (e) {
    return failFrom(e);
  }
}
