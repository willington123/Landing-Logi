import { NextRequest, NextResponse } from 'next/server';
import { fetchMedia } from '@/lib/server/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BYTES = 25 * 1024 * 1024;

// Admin: a photo, voice note, video or document the customer sent, from WhatsApp.
// The file is read whole so the player can jump to any second (Range → 206); phones and Safari need that to
// show the length and play at all. ?as=mp3 converts a voice note for browsers that can't play OGG/Opus (iPhone).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^\d{5,40}$/.test(params.id)) return NextResponse.json({ success: false, error: 'Archivo no válido.' }, { status: 400 });
  const r = await fetchMedia(params.id);
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  const len = Number(r.res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return NextResponse.json({ success: false, error: 'El archivo es demasiado grande para verlo aquí.' }, { status: 413 });
  let data: Buffer = Buffer.from(await r.res.arrayBuffer());
  let mime = r.mime.split(';')[0].trim() || 'application/octet-stream';
  if (req.nextUrl.searchParams.get('as') === 'mp3' && mime.startsWith('audio/') && mime !== 'audio/mpeg') {
    try {
      data = await (await import('@/lib/server/product-media')).toMp3(data);
      mime = 'audio/mpeg';
    } catch (e) {
      console.error('Nota de voz a MP3', e);
    }
  }
  const name = (req.nextUrl.searchParams.get('name') || '').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    // Documents download; photos, audio and video show inline. Never run as a page.
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  };
  if (name) headers['Content-Disposition'] = `attachment; filename="${name}"`;
  const total = data.length;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, total - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
    if (start >= total || start > end) return new NextResponse(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${total}` } });
    const part = data.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(part), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(part.length) } });
  }
  return new NextResponse(new Uint8Array(data), { status: 200, headers: { ...headers, 'Content-Length': String(total) } });
}
