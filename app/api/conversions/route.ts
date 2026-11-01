import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { getConversionLog, getConversionSettings, saveConversionSettings } from '@/lib/server/conversions';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// When this store tells Meta about a sale, and the last events sent.
export async function GET() {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const [settings, log] = await Promise.all([getConversionSettings(), getConversionLog()]);
    return ok({ settings, log });
  } catch (e) {
    return failFrom(e);
  }
}

export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    return ok({ settings: await saveConversionSettings({ saleEvent: b.saleEvent, whatsapp: b.whatsapp }) });
  } catch (e: any) {
    if (e instanceof Forbidden) return fail(e.message, 403);
    return failFrom(e);
  }
}
