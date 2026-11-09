// Voice notes the customer sends (WhatsApp, Messenger, Instagram) become text (Whisper on Groq, Gemini as backup), so the AI
// assistant, the automatic replies and the team understand them. The audio stays playable in Mensajes.
import { db } from '@/lib/server/db';
import { fetchMedia, type InboundMessage } from '@/lib/server/whatsapp';
import { mediaFromPayload } from '@/lib/server/wa-store';
import { transcribe, transcriptionOn } from '@/lib/server/transcribe';

const MAX_BYTES = 15 * 1024 * 1024;
export const voiceNotesOn = transcriptionOn;

// Where the audio of this message is (WhatsApp media id, or the file link Messenger / Instagram send).
function audioSource(m: InboundMessage): { mediaId?: string; url?: string } | null {
  const raw: any = m.raw || {};
  if (m.type === 'audio') {
    const media = mediaFromPayload(raw);
    return media?.kind === 'audio' ? { mediaId: media.id } : null;
  }
  if (typeof raw.audioUrl === 'string' && /^https:\/\//.test(raw.audioUrl)) return { url: raw.audioUrl };
  return null;
}
export const isVoiceNote = (m: InboundMessage) => Boolean(audioSource(m));

async function download(src: { mediaId?: string; url?: string }): Promise<{ data: Buffer; mime: string } | null> {
  let res: Response;
  let mime = '';
  if (src.mediaId) {
    const f = await fetchMedia(src.mediaId);
    if (!f.ok) return null;
    res = f.res;
    mime = f.mime;
  } else {
    res = await fetch(src.url!, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!res.ok) return null;
    mime = res.headers.get('content-type') || 'audio/mp4';
  }
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return null;
  const data = Buffer.from(await res.arrayBuffer());
  return data.length && data.length <= MAX_BYTES ? { data, mime } : null;
}

// Transcribes the voice note and saves the text on the message. Returns the text ('' if it couldn't).
export async function transcribeVoiceNote(m: InboundMessage): Promise<string> {
  const src = audioSource(m);
  if (!src || !transcriptionOn()) return '';
  try {
    const file = await download(src);
    if (!file) return '';
    const text = await transcribe(file.data, file.mime);
    if (!text) return '';
    const d = await db();
    const { data: row } = await d.from('wa_messages').select('id, payload').eq('wa_message_id', m.waMessageId).maybeSingle();
    if (row) {
      const social = !m.type || m.type !== 'audio';
      await d
        .from('wa_messages')
        .update({ body: social ? `🎤 Nota de voz: ${text}` : text, payload: { ...((row.payload as object) || {}), transcript: text } })
        .eq('id', row.id);
      await d.from('wa_conversations').update({ last_message: `🎤 ${text}`.replace(/\s+/g, ' ').slice(0, 160) }).eq('id', m.from);
    }
    return text;
  } catch (e) {
    console.error('Nota de voz: no se pudo transcribir', e);
    return '';
  }
}
