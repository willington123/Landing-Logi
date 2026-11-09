// Photos and the voice note of each product, saved per store in the "settings" table (row "wa_product_media").
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { db, uploadPublicFile, uploadPublicImage } from '@/lib/server/db';
import { transcribe, transcriptionOn } from '@/lib/server/transcribe';
import { EMPTY_MEDIA, MAX_AUDIO_SECONDS, MAX_MEDIA_IMAGES, type MediaImage, type ProductMedia } from '@/lib/product-media';

const ROW = 'wa_product_media';
const userError = (m: string) => Object.assign(new Error(m), { userFacing: true });

export async function getAllMedia(): Promise<Record<string, ProductMedia>> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', ROW).maybeSingle();
  if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(error.message);
  return ((data?.data as any)?.items as Record<string, ProductMedia>) || {};
}
export async function getMedia(productId: string): Promise<ProductMedia> {
  return (await getAllMedia())[productId] || EMPTY_MEDIA;
}
async function save(productId: string, media: ProductMedia) {
  const all = await getAllMedia();
  if (!media.images.length && !media.audio) delete all[productId];
  else all[productId] = media;
  const { error } = await (await db()).from('settings').upsert({ id: ROW, data: { items: all } });
  if (error) throw new Error(error.message);
}

// Photos: kept URLs stay; pasted ones (data URLs) are uploaded.
export async function saveImages(productId: string, images: { url: string; name?: string; caption?: string }[]): Promise<MediaImage[]> {
  const cur = await getMedia(productId);
  const keep = new Set(cur.images.map((i) => i.url));
  const out: MediaImage[] = [];
  for (const img of images.slice(0, MAX_MEDIA_IMAGES)) {
    const caption = String(img.caption || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const name = String(img.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (img.url.startsWith('data:image/')) out.push({ url: await uploadPublicImage(`media/${productId}`, img.url), name, caption });
    else if (keep.has(img.url)) out.push({ url: img.url, name, caption });
  }
  await save(productId, { ...cur, images: out });
  return out;
}

// ---------- voice note ----------

function ffmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const p = require('ffmpeg-static') as string | null;
  if (!p) throw new Error('No se encontró el convertidor de audio.');
  return p;
}

function run(bin: string, args: string[]): Promise<{ code: number; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err = (err + d.toString()).slice(-4000)));
    const timer = setTimeout(() => child.kill('SIGKILL'), 45000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, err });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: 1, err: String(e) });
    });
  });
}

// A voice note the customer sent (OGG/Opus) → MP3, for phones whose browser can't play Opus (iPhone shows "0:00").
export async function toMp3(input: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mp3-'));
  const src = path.join(dir, `in-${randomUUID()}`);
  const out = path.join(dir, 'out.mp3');
  try {
    await fs.writeFile(src, input);
    const r = await run(ffmpegPath(), ['-hide_banner', '-nostdin', '-y', '-i', src, '-vn', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', out]);
    if (r.code !== 0) throw new Error('No se pudo convertir el audio.');
    return await fs.readFile(out);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Any audio (mp3, m4a, ogg, webm from the panel's recorder…) → OGG/Opus mono, the format WhatsApp plays as a voice note.
export async function toVoiceNote(input: Buffer): Promise<{ data: Buffer; seconds: number | null }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vn-'));
  const src = path.join(dir, `in-${randomUUID()}`);
  const out = path.join(dir, 'out.ogg');
  try {
    await fs.writeFile(src, input);
    const r = await run(ffmpegPath(), ['-hide_banner', '-nostdin', '-y', '-i', src, '-vn', '-t', String(MAX_AUDIO_SECONDS), '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-compression_level', '5', '-application', 'audio', '-f', 'ogg', out]);
    if (r.code !== 0) throw userError('No pudimos leer ese audio. Prueba con un mp3, m4a u ogg.');
    const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(r.err);
    const total = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
    return { data: await fs.readFile(out), seconds: total === null ? null : Math.min(MAX_AUDIO_SECONDS, Math.round(total)) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function saveAudio(productId: string, dataUrl: string): Promise<ProductMedia> {
  const m = /^data:([\w/+.-]+)(?:;[^,]*)?;base64,([\s\S]+)$/.exec(dataUrl || '');
  if (!m || !/^(audio|video)\//.test(m[1])) throw userError('Elige un archivo de audio.');
  const raw = Buffer.from(m[2], 'base64');
  if (raw.length > 3.2 * 1024 * 1024) throw userError('El audio pesa más de 3 MB. Usa uno más corto (hasta unos 3 minutos) o grábalo aquí mismo.');
  const { data, seconds } = await toVoiceNote(raw);
  const url = await uploadPublicFile(`media/${productId}`, data, 'audio/ogg', 'ogg');
  // The transcript is a second step (transcribeSaved): together they could pass the server's time limit.
  const cur = await getMedia(productId);
  const next = { ...cur, audio: { url, transcript: '', seconds, updatedAt: new Date().toISOString() } };
  await save(productId, next);
  return next;
}

const TRANSCRIBE_MS = 45_000;

// What the saved voice note says, once, so the assistant answers with that context.
// Blank when no transcription key is set up or it takes too long: the store can type it.
export async function transcribeSaved(productId: string): Promise<string> {
  const cur = await getMedia(productId);
  if (!cur.audio) throw userError('Primero sube el audio.');
  if (!transcriptionOn()) return '';
  const res = await fetch(cur.audio.url, { cache: 'no-store' });
  if (!res.ok) return '';
  const audio = Buffer.from(await res.arrayBuffer());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<string>((resolve) => (timer = setTimeout(() => resolve(''), TRANSCRIBE_MS)));
  const transcript = (await Promise.race([transcribe(audio, 'audio/ogg').catch(() => ''), late])).trim().slice(0, 4000);
  clearTimeout(timer);
  if (!transcript) return '';
  // Only if it's still the same voice note and nobody typed a text meanwhile.
  const now = await getMedia(productId);
  if (now.audio?.url === cur.audio.url && !now.audio.transcript) await save(productId, { ...now, audio: { ...now.audio, transcript } });
  return transcript;
}

export async function saveTranscript(productId: string, transcript: string) {
  const cur = await getMedia(productId);
  if (!cur.audio) throw userError('Primero sube el audio.');
  await save(productId, { ...cur, audio: { ...cur.audio, transcript: transcript.trim().slice(0, 4000) } });
}

export async function removeAudio(productId: string) {
  const cur = await getMedia(productId);
  await save(productId, { ...cur, audio: null });
}
