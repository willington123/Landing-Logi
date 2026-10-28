import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { getConversationWithOrder, listMessages, recordOutbound } from '@/lib/server/wa-store';
import { insideServiceWindow, sendText, whatsappEnabled } from '@/lib/server/whatsapp';

export const dynamic = 'force-dynamic';

const validId = (id: string) => /^\d{6,20}$/.test(id);

// Admin: messages of one conversation (oldest first) plus the conversation itself.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!validId(params.id)) return NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 });
  try {
    const conversation = await getConversationWithOrder(params.id);
    if (!conversation) return NextResponse.json({ success: false, error: 'Conversación no encontrada.' }, { status: 404 });
    const messages = await listMessages(params.id);
    return NextResponse.json({ success: true, conversation, messages, canReply: insideServiceWindow(conversation.last_inbound_at) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// Admin: free-text reply. Only allowed within 24 h of the customer's last message.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!whatsappEnabled()) return NextResponse.json({ success: false, error: 'WhatsApp no está configurado.' }, { status: 503 });
  if (!validId(params.id)) return NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 });
  try {
    const { text } = await req.json().catch(() => ({}));
    const body = String(text ?? '').trim().slice(0, 4096);
    if (!body) return NextResponse.json({ success: false, error: 'Escribe un mensaje.' }, { status: 400 });

    const conversation = await getConversationWithOrder(params.id);
    if (!conversation) return NextResponse.json({ success: false, error: 'Conversación no encontrada.' }, { status: 404 });
    if (!insideServiceWindow(conversation.last_inbound_at)) {
      return NextResponse.json(
        { success: false, code: 'outside_window', error: 'Han pasado más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite escribirle con una plantilla aprobada.' },
        { status: 409 },
      );
    }
    const result = await sendText(params.id, body);
    await recordOutbound({ phone: params.id, type: 'text', body, result });
    if (!result.ok) return NextResponse.json({ success: false, error: `WhatsApp rechazó el mensaje: ${result.error}` }, { status: 502 });
    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
