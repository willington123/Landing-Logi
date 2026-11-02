import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { fail, failFrom, ok } from '@/lib/server/http';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { getFlowLog, getFlows, getFlowStats, pendingJobsCount, saveFlows, testFlow } from '@/lib/server/flows';
import { cleanFlow, cleanFlows } from '@/lib/flows';
import { isAppointmentsBusiness } from '@/lib/server/agenda';
import { whatsappStatus } from '@/lib/server/whatsapp';
import { getWaSettings } from '@/lib/server/wa-store';
import { getVoiceConfig } from '@/lib/server/voice-store';
import { getBotSettings } from '@/lib/server/bot';

export const dynamic = 'force-dynamic';

const userError = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : failFrom(e));

// The store's flows, how each one is doing, the latest runs, and what's already automatic (to warn about doubles).
export async function GET() {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const [flows, stats, log, pending, appointments, wa, waSet, voice, bot] = await Promise.all([
      getFlows(),
      getFlowStats(),
      getFlowLog(),
      pendingJobsCount(),
      isAppointmentsBusiness().catch(() => false),
      whatsappStatus(),
      getWaSettings().catch(() => ({ mode: 'template' as const, fallbackMinutes: 0 })),
      getVoiceConfig().catch(() => null),
      getBotSettings(),
    ]);
    return ok({
      flows,
      stats,
      log,
      pending,
      businessType: appointments ? 'appointments' : 'orders',
      builtIn: {
        whatsapp: Boolean(wa.connected),
        confirmOnOrder: Boolean(wa.connected && wa.confirmTemplate && waSet.mode === 'template'),
        autoCall: Boolean(voice?.autoCall),
        followUp: Boolean(bot.enabled && bot.followUp.enabled),
      },
    });
  } catch (e) {
    return userError(e);
  }
}

// Save the whole list. Body: { flows }.
export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const flows = cleanFlows(b.flows);
    if (typeof flows === 'string') return fail(flows, 400);
    await saveFlows(flows);
    return ok({ flows });
  } catch (e) {
    return userError(e);
  }
}

// Try a flow now with the latest order / appointment / chat. Body: { flow }.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const flow = cleanFlow(b.flow);
    if (typeof flow === 'string') return fail(flow, 400);
    return ok({ result: await testFlow(flow) });
  } catch (e) {
    return userError(e);
  }
}
