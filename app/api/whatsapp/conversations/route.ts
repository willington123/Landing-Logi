import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { listConversations } from '@/lib/server/wa-store';
import { whatsappStatus } from '@/lib/server/whatsapp';
import { chatScope, getAgents, getAssignments, getConversationAds, getConversationTags, getTags } from '@/lib/server/crm-store';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { storedIntegrations } from '@/lib/server/integrations';
import { botConfigured, getBotSettings, getBotStates } from '@/lib/server/bot';
import { followUpsSent } from '@/lib/server/followup';
import { adNames } from '@/lib/server/ad-names';

export const dynamic = 'force-dynamic';

// Admin: WhatsApp conversations, newest first, with the linked order.
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const botStates = await getBotStates();
    const waiting = Object.keys(botStates).filter((id) => botStates[id].paused && (botStates[id].reason === 'handoff' || botStates[id].reason === 'limit'));
    const [conversations, tagMap, tags, agents, assign, bot, ads, followUps] = await Promise.all([
      listConversations(200, waiting),
      getConversationTags(),
      getTags(),
      getAgents(),
      getAssignments(),
      getBotSettings(),
      getConversationAds(),
      followUpsSent(),
    ]);
    // Members who only see their chats get just those.
    const [scope, role] = await Promise.all([chatScope(), currentRole()]);
    const visible = scope.restricted ? conversations.filter((c) => assign[c.id] === scope.agentId) : conversations;
    // Which ad brought each customer: the click-to-WhatsApp ad, or else the ad of the landing order linked to the chat.
    const adOf = (c: (typeof visible)[number]) => {
      const a = ads[c.id];
      if (a) return { id: a.id, headline: a.headline || null, body: a.body || null, url: a.url || null, thumb: a.thumb || null, at: a.at, via: 'chat' as const };
      const o = c.order as any;
      return o?.adId ? { id: String(o.adId), headline: o.adHeadline || null, body: null, url: null, thumb: null, at: o.createdAt, via: 'order' as const } : null;
    };
    const names = await adNames(visible.map((c) => adOf(c)?.id || '').filter(Boolean)).catch(() => ({}) as Awaited<ReturnType<typeof adNames>>);
    const known = new Set(tags.map((t) => t.id));
    const people = new Set(agents.map((a) => a.id));
    return NextResponse.json({
      success: true,
      conversations: visible.map((c) => ({
        ...c,
        tags: (tagMap[c.id] || []).filter((id) => known.has(id)),
        assignee: assign[c.id] && people.has(assign[c.id]) ? assign[c.id] : null,
        ad: (() => {
          const a = adOf(c);
          if (!a) return null;
          const n = names[a.id];
          return { ...a, name: n?.name || null, campaign: n?.campaign || null, adset: n?.adset || null, thumb: a.thumb || n?.thumb || null, preview: n?.preview || null };
        })(),
        // The automatic follow-up went out after the customer's last message (an older one doesn't count).
        followUpAt: followUps[c.id] && c.last_inbound_at && followUps[c.id] > c.last_inbound_at ? followUps[c.id] : null,
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
