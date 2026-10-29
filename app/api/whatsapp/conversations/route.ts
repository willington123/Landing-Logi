import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { listConversations } from '@/lib/server/wa-store';
import { whatsappStatus } from '@/lib/server/whatsapp';
import { getConversationTags, getTags } from '@/lib/server/crm-store';

export const dynamic = 'force-dynamic';

// Admin: WhatsApp conversations, newest first, with the linked order.
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const [conversations, tagMap, tags] = await Promise.all([listConversations(), getConversationTags(), getTags()]);
    const known = new Set(tags.map((t) => t.id));
    return NextResponse.json({
      success: true,
      conversations: conversations.map((c) => ({ ...c, tags: (tagMap[c.id] || []).filter((id) => known.has(id)) })),
      tags,
      whatsapp: whatsappStatus(),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
