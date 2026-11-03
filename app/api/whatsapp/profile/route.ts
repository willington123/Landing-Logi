import { NextRequest } from 'next/server';
import { fail, failFrom, ok } from '@/lib/server/http';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { currentOrgId } from '@/lib/server/tenant';
import { getWaProfile, saveWaProfile, setWaPhoto } from '@/lib/server/wa-profile';
import { cleanProfile } from '@/lib/wa-profile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const userError = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e?.userFacing ? fail(e.message, 400) : failFrom(e));

// What customers see on the store's WhatsApp: photo, info, description, address, email, websites, category.
export async function GET() {
  try {
    await currentOrgId();
    return ok(await getWaProfile());
  } catch (e) {
    return userError(e);
  }
}

// Owners and admins. Body: the profile fields.
export async function PUT(req: NextRequest) {
  try {
    await requireManager();
    const clean = cleanProfile(await req.json().catch(() => ({})));
    if (typeof clean === 'string') return fail(clean, 400);
    await saveWaProfile(clean);
    return ok(await getWaProfile());
  } catch (e) {
    return userError(e);
  }
}

// New photo. Body: { image: "data:image/jpeg;base64,…" }.
export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const { image } = await req.json().catch(() => ({}));
    const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(String(image || ''));
    if (!m) return fail('Elige una foto JPG o PNG.', 400);
    await setWaPhoto(Buffer.from(m[2], 'base64'), m[1]);
    return ok(await getWaProfile());
  } catch (e) {
    return userError(e);
  }
}
