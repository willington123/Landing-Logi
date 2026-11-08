import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, downloadFile, publicFileUrl, uploadPublicFile } from '@/lib/server/db';
import { getConversationWithOrder, recordOutbound } from '@/lib/server/wa-store';
import { insideServiceWindow, sendMedia } from '@/lib/server/whatsapp';
import { getBotSettings, setBotState } from '@/lib/server/bot';
import { assertCanSeeChat, getAgents, myAgent } from '@/lib/server/crm-store';
import { currentOrgId, sessionUserId } from '@/lib/server/tenant';
import { getUser } from '@/lib/server/accounts';
import { CHAT_ID_RE, isSocialChat } from '@/lib/social';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LABEL: Record<string, string> = { image: '📷 Foto', video: '🎬 Video', audio: '🎤 Nota de voz', document: '📄 Documento' };

async function whoAmI() {
  const uid = sessionUserId();
  if (!uid) return undefined;
  const agent = await myAgent(await getAgents()).catch(() => null);
  if (agent) return { uid, name: agent.name };
  const user = await getUser(uid).catch(() => null);
  return { uid, name: (user?.name || user?.email?.split('@')[0] || 'Equipo').slice(0, 60) };
}

// Photos / voice note of a product (Productos → Fotos y nota de voz), picked by a person in the chat.
// Body: { productId, urls: string[], audio?: boolean }. Only material saved for that product can be sent.
async function sendProductMaterial(chatId: string, b: { productId?: unknown; urls?: unknown; audio?: unknown }) {
  const { getMedia } = await import('@/lib/server/product-media');
  const { photoName } = await import('@/lib/product-media');
  const { getBotState } = await import('@/lib/server/bot');
  const productId = String(b.productId || '');
  const media = await getMedia(productId);
  const wanted = new Set(Array.isArray(b.urls) ? b.urls.map(String) : []);
  const images = media.images.filter((m) => wanted.has(m.url));
  const audio = b.audio && media.audio ? media.audio : null;
  if (!images.length && !audio) return NextResponse.json({ success: false, error: 'Elige al menos una foto.' }, { status: 400 });
  const conversation = await getConversationWithOrder(chatId);
  if (!conversation) return NextResponse.json({ success: false, error: 'Conversación no encontrada.' }, { status: 404 });
  if (!insideServiceWindow(conversation.last_inbound_at))
    return NextResponse.json({ success: false, code: 'outside_window', error: 'Han pasado más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite escribirle con una plantilla aprobada.' }, { status: 409 });
  const by = await whoAmI();
  const now = new Date().toISOString();
  const sentImages: Record<string, string> = {};
  const failed: string[] = [];
  for (const img of images) {
    const result = await sendMedia(chatId, 'image', img.url, { caption: img.caption || '' });
    await recordOutbound({ phone: chatId, type: 'image', body: `📷 ${photoName(img)}${img.caption ? `: ${img.caption}` : ''}`, result, by, payload: { type: 'image', image: { link: img.url, ...(img.caption ? { caption: img.caption } : {}) } } });
    if (result.ok) sentImages[img.url] = now;
    else failed.push(result.error || 'error');
  }
  let audioSent = false;
  if (audio) {
    const result = await sendMedia(chatId, 'audio', audio.url);
    await recordOutbound({ phone: chatId, type: 'audio', body: '🎤 Nota de voz del producto', result, by, payload: { type: 'audio', audio: { link: audio.url } } });
    if (result.ok) audioSent = true;
    else failed.push(result.error || 'error');
  }
  // The AI won't send these again to this customer, and stops answering: a person is handling the chat.
  const bot = await getBotSettings().catch(() => null);
  const state = await getBotState(chatId).catch(() => ({}) as Awaited<ReturnType<typeof getBotState>>);
  const cur = state.mediaSent?.[productId] || {};
  const sentCount = Object.keys(sentImages).length;
  if (sentCount || audioSent)
    await setBotState(chatId, {
      mediaSent: { ...(state.mediaSent || {}), [productId]: { ...cur, ...(sentCount ? { photos: now, images: { ...(cur.images || {}), ...sentImages } } : {}), ...(audioSent ? { audio: now } : {}) } },
      ...(bot?.enabled ? { paused: true, pausedAt: now, reason: 'human' as const, note: undefined } : {}),
    }).catch(() => {});
  if (failed.length && !sentCount && !audioSent) return NextResponse.json({ success: false, error: `WhatsApp rechazó el envío: ${failed[0]}` }, { status: 502 });
  return NextResponse.json({ success: true, sent: sentCount, audio: audioSent, ...(failed.length ? { warning: `${failed.length} no se pudieron enviar.` } : {}) });
}

// Step 2: send the uploaded file. Body: { path, kind, caption?, filename?, voice? } (voice = recorded voice note).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!CHAT_ID_RE.test(params.id) || isSocialChat(params.id)) return NextResponse.json({ success: false, error: 'Por ahora los archivos solo se envían por WhatsApp.' }, { status: 400 });
  try {
    const org = await currentOrgId();
    await assertCanSeeChat(params.id);
    const b = await req.json().catch(() => ({}));
    if (b.productId) return sendProductMaterial(params.id, b);
    const kind = String(b.kind || '') as 'image' | 'video' | 'audio' | 'document';
    const path = String(b.path || '');
    if (!LABEL[kind] || !path.startsWith(`chat/${org}/${params.id}/`) || path.includes('..')) return NextResponse.json({ success: false, error: 'Archivo no válido.' }, { status: 400 });
    const conversation = await getConversationWithOrder(params.id);
    if (!conversation) return NextResponse.json({ success: false, error: 'Conversación no encontrada.' }, { status: 404 });
    if (!insideServiceWindow(conversation.last_inbound_at))
      return NextResponse.json({ success: false, code: 'outside_window', error: 'Han pasado más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite escribirle con una plantilla aprobada.' }, { status: 409 });

    let link = publicFileUrl(path);
    // Audio (recorded here or uploaded) goes as a WhatsApp voice note: converted to OGG/Opus.
    if (kind === 'audio' && !/\.ogg$/i.test(path)) {
      const { toVoiceNote } = await import('@/lib/server/product-media');
      const { data } = await toVoiceNote(await downloadFile(path));
      link = await uploadPublicFile(`chat/${org}/${params.id}`, data, 'audio/ogg', 'ogg');
    }
    const caption = String(b.caption || '').trim().slice(0, 1024);
    const filename = String(b.filename || '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
    const result = await sendMedia(params.id, kind, link, { caption, filename });
    const body = caption ? `${LABEL[kind]}: ${caption}` : kind === 'document' && filename ? `📄 ${filename}` : LABEL[kind];
    await recordOutbound({ phone: params.id, type: kind, body, result, by: await whoAmI(), payload: { type: kind, [kind]: { link, ...(caption && kind !== 'audio' ? { caption } : {}), ...(filename ? { filename } : {}) } } });
    if (!result.ok) return NextResponse.json({ success: false, error: `WhatsApp rechazó el archivo: ${result.error}` }, { status: 502 });
    // A person answered: the AI assistant stops answering this chat until it's handed back.
    if ((await getBotSettings().catch(() => null))?.enabled) await setBotState(params.id, { paused: true, pausedAt: new Date().toISOString(), reason: 'human', note: undefined }).catch(() => {});
    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (e: any) {
    const msg = e?.userFacing ? e.message : e.message;
    return NextResponse.json({ success: false, error: msg }, { status: e?.userFacing ? 400 : [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
