import { cloudEnabled } from '@/lib/server/db';
import { numberHealth } from '@/lib/server/whatsapp';
import { templateRecipients24h } from '@/lib/server/wa-store';
import { waConfig } from '@/lib/server/integrations';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// The store's WhatsApp number: Meta's daily limit, quality, speed, and how much of the limit was used.
export async function GET() {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const c = await waConfig();
    if (!c) return ok({ connected: false });
    const [h, used] = await Promise.all([numberHealth(), templateRecipients24h().catch(() => null)]);
    if (!h.ok) return ok({ connected: true, error: h.error, used24h: used });
    return ok({ connected: true, ...h.health, used24h: used, wabaId: c.wabaId });
  } catch (e) {
    return failFrom(e);
  }
}
