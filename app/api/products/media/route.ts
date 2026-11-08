import { NextRequest } from 'next/server';
import { getAllMedia, removeAudio, saveAudio, saveImages, saveTranscript, transcribeSaved } from '@/lib/server/product-media';
import { sellables } from '@/lib/server/products';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { currentOrgId } from '@/lib/server/tenant';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const handle = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e?.userFacing ? fail(e.message, 400) : failFrom(e));

// Every product that can be sold (landings + WhatsApp products) with its photos and voice note.
export async function GET() {
  try {
    await currentOrgId();
    const [list, media] = await Promise.all([sellables(), getAllMedia()]);
    return ok({
      products: list.map((l) => ({ id: l.id, name: l.productName || l.title, kind: l.kind === 'product' ? 'product' : 'landing', image: l.mainImage || null, media: media[l.id] || { images: [], audio: null } })),
    });
  } catch (e) {
    return handle(e);
  }
}

// { productId, images: [{ url | dataURL, name, caption }] } · { productId, audio: dataURL } · { productId, transcribe: true } · { productId, transcript }
export async function POST(req: NextRequest) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const productId = String(b.productId || '');
    if (!(await sellables()).some((l) => l.id === productId)) return fail('Producto no encontrado.', 404);
    if (Array.isArray(b.images)) return ok({ images: await saveImages(productId, b.images) });
    if (typeof b.audio === 'string') return ok({ media: await saveAudio(productId, b.audio) });
    if (b.transcribe) return ok({ transcript: await transcribeSaved(productId) });
    if (typeof b.transcript === 'string') {
      await saveTranscript(productId, b.transcript);
      return ok();
    }
    return fail('Nada que guardar.', 400);
  } catch (e) {
    return handle(e);
  }
}

// ?productId=… removes the voice note
export async function DELETE(req: NextRequest) {
  try {
    await requireManager();
    await removeAudio(String(req.nextUrl.searchParams.get('productId') || ''));
    return ok();
  } catch (e) {
    return handle(e);
  }
}
