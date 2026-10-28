import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processCallQueue } from '@/lib/server/voice-actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Places scheduled calls and retries. Call it every 5–10 minutes (Vercel Cron or cron-job.org)
// with "Authorization: Bearer <CRON_SECRET>" or "?secret=<CRON_SECRET>".
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return NextResponse.json({ ok: false, error: 'Falta la variable CRON_SECRET.' }, { status: 503 });
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.nextUrl.searchParams.get('secret') || '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await processCallQueue(req.nextUrl.origin)) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
