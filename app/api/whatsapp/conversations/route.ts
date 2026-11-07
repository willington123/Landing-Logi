import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { listConversations } from '@/lib/server/wa-store';
import { whatsappStatus } from '@/lib/server/whatsapp';
import { chatScope, getAgents, getAssignments, getConversationAds, getConversationTags, getTags } from '@/lib/server/crm-store';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { storedIntegrations } from '@/lib/server/integrations';
import { botConfigured, getBotSettings, getBotStates } from '@/lib/server/bot';

export const dynamic = 'force-dynamic';

// Admin: WhatsApp conversations, newest first, with the linked order.
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const botStates = await getBotStates();
    const waiting = Object.keys(botStates).filter((id) => botStates[id].paused && (botStates[id].reason === 'handoff' || botStates[id].reason === 'limit'));
    const [conversations, tagMap, tags, agents, assign, bot, ads] = await Promise.all([
      listConversations(200, waiting),
      getConversationTags(),
      getTags(),
      getAgents(),
      getAssignments(),
      getBotSettings(),
      getConversationAds(),
    ]);
    // Members who only see their chats get just those.
    const [scope, role] = await Promise.all([chatScope(), currentRole()]);
    const visible = scope.restricted ? conversations.filter((c) => assign[c.id] === scope.agentId) : conversations;
    const known = new Set(tags.map((t) => t.id));
    const people = new Set(agents.map((a) => a.id));
    return NextResponse.json({
      success: true,
      conversations: visible.map((c) => ({
        ...c,
        tags: (tagMap[c.id] || []).filter((id) => known.has(id)),
        assignee: assign[c.id] && people.has(assign[c.id]) ? assign[c.id] : null,
        ad: ads[c.id] ? { id: ads[c.id].id, headline: ads[c.id].headline || null, body: ads[c.id].body || null, url: ads[c.id].url || null, thumb: ads[c.id].thumb || null, at: ads[c.id].at } : null,
        bot: botStates[c.id]?.paused ? { paused: true, reason: botStates[c.id].reason || null, note: botStates[c.id].note || null, at: botStates[c.id].pausedAt || null } : null,
      })),
      bot: { enabled: bot.enabled && (await botConfigured()), mode: bot.mode, name: bot.name },
      tags,
      agents,
      me: { agentId: scope.agentId, restricted: scope.restricted, role },
      whatsapp: await whatsappStatus(),
      // Pages connected for Messenger / Instagram (the inbox shows their tabs even before the first chat).
      social: await currentOrgId()
        .then(storedIntegrations)
        .then((s) => {
          const pages = (s.social?.pages || []).filter((p) => p.active);
          return { messenger: pages.length > 0, instagram: pages.some((p) => p.ig) };
        })
        .catch(() => ({ messenger: false, instagram: false })),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
