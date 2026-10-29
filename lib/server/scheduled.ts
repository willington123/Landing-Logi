// Scheduled work, run by /api/cron/run (and /api/cron/calls) every few minutes.
import { timingSafeEqual } from 'crypto';
import { cloudEnabled } from '@/lib/server/db';
import { processCallQueue } from '@/lib/server/voice-actions';
import { processWaFallback } from '@/lib/server/wa-actions';

export function cronAuthorized(authHeader: string | null, querySecret: string | null): 'ok' | 'missing' | 'denied' {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return 'missing';
  const given = (authHeader || '').replace(/^Bearer\s+/i, '') || querySecret || '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b) ? 'ok' : 'denied';
}

export async function runScheduled(origin?: string) {
  if (!cloudEnabled()) return { calls: null, whatsapp: null };
  const [calls, whatsapp] = await Promise.all([
    processCallQueue(origin).catch((e) => ({ error: String(e?.message || e) })),
    processWaFallback().catch((e) => ({ error: String(e?.message || e) })),
  ]);
  return { calls, whatsapp };
}
