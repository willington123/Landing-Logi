import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { cloudEnabled, signedUpload } from '@/lib/server/db';
import { assertCanSeeChat } from '@/lib/server/crm-store';
import { currentOrgId } from '@/lib/server/tenant';
import { CHAT_ID_RE, isSocialChat } from '@/lib/social';

export const dynamic = 'force-dynamic';

// WhatsApp's size limits per kind (MB).
const LIMIT_MB: Record<string, number> = { image: 5, video: 16, audio: 16, document: 50 };
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/amr': 'amr', 'audio/x-m4a': 'm4a',
  'application/pdf': 'pdf',
};

// Step 1 of sending a file in a chat: a link the browser uploads it to. Body: { kind, mime, size, name }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!CHAT_ID_RE.test(params.id)) return NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 });
  if (isSocialChat(params.id)) return NextResponse.json({ success: false, error: 'Por ahora los archivos solo se envían por WhatsApp.' }, { status: 400 });
  try {
    const org = await currentOrgId();
    await assertCanSeeChat(params.id);
    const b = await req.json().catch(() => ({}));
    const kind = String(b.kind || '');
    if (!LIMIT_MB[kind]) return NextResponse.json({ success: false, error: 'Tipo de archivo no válido.' }, { status: 400 });
    const mime = String(b.mime || '').split(';')[0].toLowerCase();
    const size = Number(b.size) || 0;
    if (size > LIMIT_MB[kind] * 1024 * 1024) return NextResponse.json({ success: false, error: `WhatsApp acepta ${kind === 'image' ? 'fotos' : kind === 'video' ? 'videos' : kind === 'audio' ? 'audios' : 'documentos'} de hasta ${LIMIT_MB[kind]} MB.` }, { status: 400 });
    const ext = EXT[mime] || (kind === 'document' ? String(b.name || '').split('.').pop()?.replace(/[^\w]/g, '').slice(0, 8) || 'bin' : '');
    if (!ext) return NextResponse.json({ success: false, error: 'Ese formato no lo acepta WhatsApp. Usa JPG/PNG para fotos, MP4 para videos.' }, { status: 400 });
    const up = await signedUpload(`chat/${org}/${params.id}/${randomUUID()}.${ext}`);
    return NextResponse.json({ success: true, ...up });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
