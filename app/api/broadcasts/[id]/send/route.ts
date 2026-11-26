import { NextRequest } from 'next/server';
import { requireManager } from '@/lib/server/integrations-api';
import { sendRow } from '@/lib/server/broadcasts';
import { getAgents, myAgent } from '@/lib/server/crm-store';
import { getUser } from '@/lib/server/accounts';
import { sessionUserId } from '@/lib/server/tenant';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function whoAmI() {
  const uid = sessionUserId();
  if (!uid) return undefined;
  const agent = await myAgent(await getAgents()).catch(() => null);
  if (agent) return { uid, name: agent.name };
  const user = await getUser(uid).catch(() => null);
  return { uid, name: (user?.name || user?.email?.split('@')[0] || 'Equipo').slice(0, 60) };
}

// Sends one contact of the list. Body: { index }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const index = Number(b.index);
    if (!Number.isInteger(index) || index < 0) return fail('Contacto no válido.');
    try {
      return ok({ row: await sendRow(params.id, index, await whoAmI()) });
    } catch (e: any) {
      return fail(e.message);
    }
  } catch (e) {
    return failFrom(e);
  }
}
