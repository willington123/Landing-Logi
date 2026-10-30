import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { listConversations } from '@/lib/server/wa-store';
import { whatsappStatus } from '@/lib/server/whatsapp';
import { getAgents, getAssignments, getConversationTags, getTags } from '@/lib/server/crm-store';
import { botConfigured, getBotSettings, getBotStates } from '@/lib/server/bot';

export const dynamic = 'force-dynamic';

// Admin: WhatsApp conversations, newest first, with the linked order.
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const [conversations, tagMap, tags, agents, assign, botStates, bot] = await Promise.all([
      listConversations(),
      getConversationTags(),
      getTags(),
      getAgents(),
      getAssignments(),
      getBotStates(),
      getBotSettings(),
    ]);
    const known = new Set(tags.map((t) => t.id));
    const people = new Set(agents.map((a) => a.id));
    return NextResponse.json({
      success: true,
      conversations: conversations.map((c) => ({
        ...c,
        tags: (tagMap[c.id] || []).filter((id) => known.has(id)),
        assignee: assign[c.id] && people.has(assign[c.id]) ? assign[c.id] : null,
        bot: botStates[c.id]?.paused ? { paused: true, reason: botStates[c.id].reason || null, note: botStates[c.id].note || null } : null,
      })),
      bot: { enabled: bot.enabled && (await botConfigured()), mode: bot.mode, name: bot.name },
      tags,
      agents,
      whatsapp: await whatsappStatus(),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
