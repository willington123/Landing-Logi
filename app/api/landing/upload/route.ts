import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { cloudEnabled, publicFileUrl, signedUpload } from '@/lib/server/db';
import { currentOrgId } from '@/lib/server/tenant';

export const dynamic = 'force-dynamic';

// Animated GIFs for landings go up as they are (re-encoding them as JPG would freeze them). The browser uploads
// straight to Storage with this one-time link, so big files never pass through our server. Body: { mime, size }.
const MAX_MB = 8;

export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const org = await currentOrgId();
    const b = await req.json().catch(() => ({}));
    const mime = String(b.mime || '').split(';')[0].toLowerCase();
    const size = Number(b.size) || 0;
    if (mime !== 'image/gif') return NextResponse.json({ success: false, error: 'Por aquí solo se suben GIF.' }, { status: 400 });
    if (!size || size > MAX_MB * 1024 * 1024) return NextResponse.json({ success: false, error: `El GIF pesa más de ${MAX_MB} MB. Redúcelo (por ejemplo en ezgif.com) para que la página cargue rápido.` }, { status: 400 });
    const up = await signedUpload(`landings/${org}/gif/${randomUUID().replace(/-/g, '')}.gif`);
    return NextResponse.json({ success: true, ...up, url: publicFileUrl(up.path) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
