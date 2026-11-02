import { NextRequest } from 'next/server';
import { cloudEnabled, db } from '@/lib/server/db';
import { fail, failFrom, ok } from '@/lib/server/http';
import { Forbidden, requireManager } from '@/lib/server/integrations-api';
import { currentOrgId } from '@/lib/server/tenant';
import { storedIntegrations } from '@/lib/server/integrations';
import { oauthAvailable } from '@/lib/server/meta-ads';
import { disconnectSocial, getSocialLog, getSocialSettings, getSocialStats, previewComment, saveSocialSettings, setActivePages } from '@/lib/server/social';
import { cleanSocial } from '@/lib/social';

export const dynamic = 'force-dynamic';

const userError = (e: any) => (e instanceof Forbidden ? fail(e.message, 403) : e?.userFacing ? fail(e.message, 400) : failFrom(e));

// Connected pages, rules, latest comments, counts, and how many people reached WhatsApp from each rule.
export async function GET() {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const org = await currentOrgId();
    const [s, settings, log, stats] = await Promise.all([storedIntegrations(org), getSocialSettings(), getSocialLog(), getSocialStats()]);
    // People who opened WhatsApp with a rule's text in the last 30 days.
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: msgs } = await (await db()).from('wa_messages').select('conversation_id, body').eq('direction', 'in').gte('created_at', since).limit(5000);
    const reached: Record<string, number> = {};
    for (const r of settings.rules) {
      if (!r.whatsapp) continue;
      const t = r.waText.toLowerCase();
      reached[r.id] = new Set((msgs || []).filter((m: any) => String(m.body || '').toLowerCase().includes(t)).map((m: any) => m.conversation_id)).size;
    }
    return ok({
      available: oauthAvailable(),
      connected: Boolean(s.social),
      pages: (s.social?.pages || []).map((p) => ({ id: p.id, name: p.name, picture: p.picture || null, ig: p.ig || null, active: p.active })),
      whatsappNumber: (s.whatsapp?.displayPhone || '').replace(/\D/g, ''),
      settings,
      log: log.slice(0, 50),
      stats,
      reached,
    });
  } catch (e) {
    return userError(e);
  }
}

// Body: { settings?, activePages?: string[] }.
export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    let results: { id: string; ok: boolean; error?: string }[] | null = null;
    if (b.settings !== undefined) {
      const clean = cleanSocial(b.settings);
      if (typeof clean === 'string') return fail(clean, 400);
      await saveSocialSettings(clean);
    }
    if (Array.isArray(b.activePages)) results = await setActivePages(b.activePages.map(String).slice(0, 200));
    return ok({ settings: await getSocialSettings(), results });
  } catch (e) {
    return userError(e);
  }
}

// Try a comment. Body: { text, channel, name }. Nothing is posted.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    await requireManager();
    const b = await req.json().catch(() => ({}));
    const text = String(b.text || '').trim().slice(0, 500);
    if (!text) return fail('Escribe un comentario de prueba.', 400);
    return ok({ result: await previewComment(text, b.channel === 'instagram' ? 'instagram' : 'facebook', String(b.name || 'Laura').slice(0, 40)) });
  } catch (e) {
    return userError(e);
  }
}

export async function DELETE() {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    await requireManager();
    await disconnectSocial();
    return ok({});
  } catch (e) {
    return userError(e);
  }
}
