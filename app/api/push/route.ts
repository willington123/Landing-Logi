import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { currentOrgId, sessionUserId } from '@/lib/server/tenant';
import { deviceState, pushPublicKey, removeDevice, saveDevice } from '@/lib/server/push';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

async function user() {
  await currentOrgId(); // signed in and member of a store
  const uid = sessionUserId();
  if (!uid) throw Object.assign(new Error('Inicia sesión.'), { status: 401 });
  return uid;
}

// Avisos en este dispositivo. GET ?endpoint= → key to subscribe with and whether this device is on.
export async function GET(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const uid = await user();
    return ok({ publicKey: await pushPublicKey(), ...(await deviceState(uid, req.nextUrl.searchParams.get('endpoint'))) });
  } catch (e: any) {
    return e?.status === 401 ? fail(e.message, 401) : failFrom(e);
  }
}

// Body: { subscription, mode: 'all' | 'handoff' }
export async function POST(req: NextRequest) {
  try {
    const uid = await user();
    const b = await req.json().catch(() => ({}));
    await saveDevice(uid, b.subscription, b.mode === 'handoff' ? 'handoff' : 'all', req.headers.get('user-agent') || '');
    return ok({ subscribed: true, mode: b.mode === 'handoff' ? 'handoff' : 'all' });
  } catch (e: any) {
    return e?.status === 400 || e?.status === 401 ? fail(e.message, e.status) : failFrom(e);
  }
}

// Body: { endpoint }
export async function DELETE(req: NextRequest) {
  try {
    const uid = await user();
    const b = await req.json().catch(() => ({}));
    await removeDevice(uid, String(b.endpoint || ''));
    return ok({ subscribed: false });
  } catch (e: any) {
    return e?.status === 401 ? fail(e.message, 401) : failFrom(e);
  }
}
