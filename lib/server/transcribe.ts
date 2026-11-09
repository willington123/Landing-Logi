// Voice notes → text. Whisper on Groq first (GROQ_API_KEY): fast and very good with long audios and Colombian
// Spanish. Gemini (GEMINI_API_KEY) as the backup when Groq isn't set up, fails or hears nothing.
import { transcribeAudio } from '@/lib/gemini';

const groqKey = () => (process.env.GROQ_API_KEY || '').trim();
const geminiKey = () => (process.env.GEMINI_API_KEY || '').trim();
const GROQ_MODEL = () => (process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3').trim();
const MAX_CHARS = 12000;

export const transcriptionOn = () => Boolean(groqKey() || geminiKey());

// The file name tells Groq the format; formats it doesn't take (aac, amr…) go straight to Gemini.
const EXT: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'video/mp4': 'mp4',
};

// Whisper "hears" these in silence or noise.
const PHANTOM = /subt[ií]tulos (realizados )?por la comunidad de amara\.org|gracias por ver (el|este) v[ií]deo|suscr[ií]bete( al canal)?|amara\.org/gi;
function clean(text: string) {
  const t = text.replace(PHANTOM, '').replace(/\s+/g, ' ').trim();
  return /^[\s.,¡!¿?-]*$/.test(t) ? '' : t.slice(0, MAX_CHARS);
}

async function groq(data: Buffer, mime: string): Promise<string> {
  const ext = EXT[mime];
  if (!ext) return '';
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(data)], { type: mime }), `nota.${ext}`);
  form.append('model', GROQ_MODEL());
  form.append('language', 'es');
  form.append('temperature', '0');
  form.append('response_format', 'json');
  form.append('prompt', 'Nota de voz de un cliente de una tienda en Colombia: pregunta por un producto, el precio, el envío o su pedido.');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey()}` },
    body: form,
    signal: AbortSignal.timeout(40000),
    cache: 'no-store',
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Groq: ${d?.error?.message || `HTTP ${res.status}`}`);
  return clean(String(d?.text || ''));
}

// '' when nobody could understand it (or no key is set up).
export async function transcribe(data: Buffer, mimeType: string): Promise<string> {
  const mime = (mimeType || 'audio/ogg').split(';')[0].trim().toLowerCase() || 'audio/ogg';
  if (groqKey()) {
    try {
      const text = await groq(data, mime);
      if (text) return text;
    } catch (e) {
      console.error('Nota de voz (Groq): no se pudo transcribir, se intenta con Gemini', e);
    }
  }
  if (!geminiKey()) return '';
  return (await transcribeAudio(geminiKey(), data.toString('base64'), mime)).slice(0, MAX_CHARS);
}
