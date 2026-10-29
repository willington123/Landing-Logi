import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { publicBaseUrl } from '@/lib/server/vapi';
import { getSchedulerInfo, supabaseCronSql } from '@/lib/server/scheduled';

export const dynamic = 'force-dynamic';

// Admin (not under /api/cron, which is public): scheduler status and the Supabase SQL (contains CRON_SECRET).
export async function GET(req: NextRequest) {
  const baseUrl = publicBaseUrl(req.nextUrl.origin);
  const cronSecret = Boolean((process.env.CRON_SECRET || '').trim());
  const info = cloudEnabled() ? await getSchedulerInfo().catch(() => ({})) : {};
  return NextResponse.json({ success: true, ...info, cronSecret, baseUrl, sql: supabaseCronSql(baseUrl) });
}
