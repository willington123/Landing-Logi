// Photos and a voice note the AI assistant can send in a WhatsApp chat, per product (a landing or a WhatsApp product).
export interface MediaImage {
  url: string;
  caption: string; // what it shows, so the assistant knows which one to send ('' = none)
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
export const MAX_MEDIA_IMAGES = 6;
export const MAX_AUDIO_SECONDS = 180;
export const EMPTY_MEDIA: ProductMedia = { images: [], audio: null };
