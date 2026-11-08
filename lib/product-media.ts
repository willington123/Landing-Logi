// Photos and a voice note the AI assistant can send in a WhatsApp chat, per product (a landing or a WhatsApp product).
export interface MediaImage {
  url: string;
  name?: string; // what it is, for the assistant to pick it ("Precios", "Producto", "Tallas"…). Not shown to the customer.
  caption: string; // text sent with the photo ('' = none)
}
export interface MediaAudio {
  url: string; // OGG/Opus, so WhatsApp shows it as a voice note
  transcript: string; // what it says (the assistant's context)
  seconds: number | null;
  updatedAt: string;
}
export interface ProductMedia {
  images: MediaImage[];
  audio: MediaAudio | null;
}
export const MAX_MEDIA_IMAGES = 12;
// Ready-made names: the assistant sends the photo whose name matches what the customer asks.
export const PHOTO_NAMES = ['Producto', 'Precios', 'Tallas y medidas', 'Cómo se usa', 'Resultados', 'Testimonios', 'Envíos y pago'];
// Photos saved before names existed used the caption as their description.
export const photoName = (img: MediaImage) => (img.name || img.caption || 'Producto').trim();
export const MAX_AUDIO_SECONDS = 180;
export const EMPTY_MEDIA: ProductMedia = { images: [], audio: null };

// Which photos to send for what the assistant asked (photo numbers, 1-based), each one once per customer.
// No numbers: the photos named "Producto" (or the first three). Chats from before the per-photo record count all as sent.
export function photosToSend(images: MediaImage[], numbers: number[], sent: { photos?: string; images?: Record<string, string> }, again: boolean) {
  const picks = Array.from(new Set(numbers.filter((n) => Number.isInteger(n) && n >= 1 && n <= images.length)));
  const productPhotos = images.filter((m) => /producto|foto/i.test(photoName(m)));
  const chosen = picks.length ? picks.map((n) => images[n - 1]) : (productPhotos.length ? productPhotos : images).slice(0, 3);
  const legacyAllSent = Boolean(sent.photos && !sent.images);
  const already = (m: MediaImage) => !again && (Boolean(sent.images?.[m.url]) || legacyAllSent);
  return { send: chosen.filter((m) => !already(m)), skipped: chosen.filter(already) };
}
