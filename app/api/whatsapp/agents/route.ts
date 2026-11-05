import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { ensureAgentFor, getAgents, getRouting, myAgent, saveAgents, saveRouting, setMyAvailability } from '@/lib/server/crm-store';
import { cleanAgents, cleanRouting } from '@/lib/crm';
import { currentOrgId, currentRole, sessionUserId } from '@/lib/server/tenant';
import { listMembers } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

const noDb = () => NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
const fail = (e: any) => NextResponse.json({ success: false, error: e?.message || String(e) }, { status: [401, 402, 403].includes(e?.status) ? e.status : 500 });
const manager = (r: string | null) => r === 'owner' || r === 'admin';

// The people who answer chats, the store's accounts they can be linked to, automatic assignment, and who I am.
export async function GET() {
  if (!cloudEnabled()) return noDb();
  try {
    const orgId = await currentOrgId();
    let [items, routing, role, members] = await Promise.all([getAgents(), getRouting(), currentRole(), listMembers(orgId)]);
    // Team members who joined before advisors were created on their own (owners stay out unless added by hand).
    const missing = members.filter((m) => m.role !== 'owner' && !items.some((a) => a.userId === m.userId));
    if (missing.length && manager(role)) {
      for (const m of missing) await ensureAgentFor(orgId, { id: m.userId, name: m.name, email: m.email }).catch(() => null);
      items = await getAgents();
    }
    const me = await myAgent(items);
    return NextResponse.json({
      success: true,
      items,
      routing: { enabled: routing.enabled, when: routing.when },
      members: members.map((m) => ({ userId: m.userId, name: m.name, email: m.email, role: m.role })),
      me: { userId: sessionUserId(), agentId: me?.id || null, role, canManage: manager(role) },
    });
  } catch (e) {
    return fail(e);
  }
}

// Owners and admins. Body: { items?: Agent[], routing? }. Chats assigned to someone removed become unassigned.
export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return noDb();
  try {
    if (!manager(await currentRole())) return NextResponse.json({ success: false, error: 'Solo el dueño o un administrador pueden organizar el equipo.' }, { status: 403 });
    const { items, routing } = await req.json().catch(() => ({}));
    let saved = await getAgents();
    if (items !== undefined) {
      const clean = cleanAgents(items);
      if (typeof clean === 'string') return NextResponse.json({ success: false, error: clean }, { status: 400 });
      // "Solo ve sus chats" is for members; owners and admins always see everything.
      const roles = new Map((await listMembers(await currentOrgId())).map((m) => [m.userId, m.role]));
      saved = clean.map((a) => ({ ...a, userId: a.userId && roles.has(a.userId) ? a.userId : null, onlyAssigned: Boolean(a.onlyAssigned && a.userId && roles.get(a.userId) === 'member') }));
      await saveAgents(saved);
    }
    if (routing !== undefined) await saveRouting(cleanRouting(routing));
    const r = await getRouting();
    return NextResponse.json({ success: true, items: saved, routing: { enabled: r.enabled, when: r.when } });
  } catch (e) {
    return fail(e);
  }
}

// Anyone on the team: "Disponible / Ausente" for themselves. Body: { available }.
export async function PATCH(req: NextRequest) {
  if (!cloudEnabled()) return noDb();
  try {
    const { available } = await req.json().catch(() => ({}));
    const me = await setMyAvailability(Boolean(available));
    if (!me) return NextResponse.json({ success: false, error: 'Tu cuenta no está unida a una persona del equipo. Pídele al dueño que te una en Mensajes → Equipo.' }, { status: 400 });
    return NextResponse.json({ success: true, agent: me });
  } catch (e) {
    return fail(e);
  }
}
