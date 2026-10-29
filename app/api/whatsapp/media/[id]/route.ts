import { NextRequest, NextResponse } from 'next/server';
import { fetchMedia } from '@/lib/server/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Admin: a photo, voice note, video or document the customer sent, streamed from WhatsApp.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^\d{5,40}$/.test(params.id)) return NextResponse.json({ success: false, error: 'Archivo no válido.' }, { status: 400 });
  const r = await fetchMedia(params.id);
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  const name = (req.nextUrl.searchParams.get('name') || '').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
  const headers: Record<string, string> = {
    'Content-Type': r.mime,
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    // Documents download; photos, audio and video show inline. Never run as a page.
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  };
  if (name) headers['Content-Disposition'] = `attachment; filename="${name}"`;
  const len = r.res.headers.get('content-length');
  if (len) headers['Content-Length'] = len;
  return new NextResponse(r.res.body, { status: 200, headers });
}
