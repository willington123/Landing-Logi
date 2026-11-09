import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { tagPastChats } from '@/lib/server/auto-tag';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Mensajes → Etiquetas → "Etiquetar con IA". Body: { days }. One round; the panel calls again while remaining > 0.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const b = await req.json().catch(() => ({}));
    const days = [1, 7, 30].includes(Number(b.days)) ? Number(b.days) : 7;
    const r = await tagPastChats({ days, deadline: Date.now() + 40_000 });
    if (r.error && !r.checked) return fail(r.error, 400);
    return ok(r);
  } catch (e: any) {
    return failFrom(e);
  }
}
