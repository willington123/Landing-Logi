import { NextRequest, NextResponse } from 'next/server';
import { cronAuthorized, noteDenied, runScheduled } from '@/lib/server/scheduled';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Same as /api/cron/run (kept for existing setups). Scheduled tasks (AI call retries and scheduled calls, WhatsApp fallback templates).
// Call every 5–10 min with "Authorization: Bearer <CRON_SECRET>" or "?secret=<CRON_SECRET>".
export async function GET(req: NextRequest) {
  const auth = cronAuthorized(req.headers.get('authorization'), req.nextUrl.searchParams.get('secret'));
  if (auth === 'missing') return NextResponse.json({ ok: false, error: 'Falta la variable CRON_SECRET.' }, { status: 503 });
  if (auth === 'denied') {
    await noteDenied();
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runScheduled(req.nextUrl.origin, 'cron')) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
