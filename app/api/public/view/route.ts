import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, incrementLandingViews } from '@/lib/server/db';
import { maybeRunScheduled } from '@/lib/server/scheduled';

export const dynamic = 'force-dynamic';

// Public: counts one visit to a landing (the page sends it once per browser session).
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false }, { status: 503 });
  try {
    const { landingId } = await req.json();
    await incrementLandingViews(String(landingId || '').slice(0, 120));
    // Backup for the scheduled task: visits also check pending work (at most every few minutes).
    // The landing doesn't wait for this response, so the visitor never notices.
    await maybeRunScheduled(req.nextUrl.origin, 'visita');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
