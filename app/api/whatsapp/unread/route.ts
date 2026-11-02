import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { unreadSummary } from '@/lib/server/wa-store';
import { chatScope, getAssignments } from '@/lib/server/crm-store';

export const dynamic = 'force-dynamic';

// Admin: unread WhatsApp messages (menu badge, new-message sound and the notice for the chats assigned to me).
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: true, unread: 0, chats: 0, lastInboundAt: null, mine: null });
  try {
    const [scope, assign] = await Promise.all([chatScope(), getAssignments()]);
    const mine = scope.agentId ? (id: string) => assign[id] === scope.agentId : undefined;
    return NextResponse.json({ success: true, ...(await unreadSummary({ only: scope.restricted ? mine : undefined, mine })), linked: Boolean(scope.agentId) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
