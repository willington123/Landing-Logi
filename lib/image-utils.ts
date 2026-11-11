'use client';

// Resizes and re-encodes an image as JPEG so it fits in localStorage and uploads fast.
export function compressImage(src: string, maxSide = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(src);
      ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        reject(new Error('No se pudo procesar la imagen (el servidor de origen no lo permite).'));
      }
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    // Remote images need CORS so the canvas can export them.
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

// Animated GIFs keep their animation: uploaded as they are (no canvas re-encoding). Returns the public URL,
// or the GIF as a data URL when there's no database (local mode).
export async function uploadGif(file: File): Promise<string> {
  const res = await fetch('/api/landing/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mime: 'image/gif', size: file.size }) });
  const up = await res.json().catch(() => ({}));
  if (res.status === 503) return fileToDataUrl(file);
  if (!res.ok || !up.success) throw new Error(up.error || `No se pudo subir el GIF (HTTP ${res.status}).`);
  const put = await fetch(up.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/gif', 'x-upsert': 'false' }, body: file });
  if (!put.ok) throw new Error(`No se pudo subir el GIF (HTTP ${put.status}).`);
  return up.url as string;
}

export const isGif = (file?: File | null) => Boolean(file && (file.type === 'image/gif' || /\.gif$/i.test(file.name)));
