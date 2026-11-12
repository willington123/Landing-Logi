// Reads and changes the WhatsApp Business profile of the store's number, and uploads its photo.
import { waConfig } from '@/lib/server/integrations';
import { GRAPH_VERSION } from '@/lib/server/whatsapp';
import type { WaProfile } from '@/lib/wa-profile';

const env = (k: string) => (process.env[k] || '').trim();
const GRAPH = () => `${env('META_GRAPH_URL') || 'https://graph.facebook.com'}/${GRAPH_VERSION}`;

export class WaProfileError extends Error {
  userFacing = true;
}

async function call(method: 'GET' | 'POST', path: string, token: string, body?: unknown) {
  const res = await fetch(`${GRAPH()}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new WaProfileError(data?.error?.error_user_msg || data?.error?.message || `WhatsApp respondió HTTP ${res.status}`);
  return data;
}

async function cfg() {
  const c = await waConfig();
  if (!c) throw new WaProfileError('Conecta WhatsApp primero.');
  return c;
}

const FIELDS = 'about,address,description,email,profile_picture_url,websites,vertical';

export async function getWaProfile(): Promise<{ profile: WaProfile; name: string | null; nameStatus: string | null; phone: string | null; wabaId: string | null }> {
  const c = await cfg();
  const [p, info] = await Promise.all([
    call('GET', `${c.phoneNumberId}/whatsapp_business_profile?fields=${FIELDS}`, c.token),
    call('GET', `${c.phoneNumberId}?fields=display_phone_number,verified_name,name_status`, c.token).catch(() => ({})),
  ]);
  const d = (p?.data || [])[0] || {};
  return {
    profile: {
      about: String(d.about || ''),
      description: String(d.description || ''),
      address: String(d.address || ''),
      email: String(d.email || ''),
      websites: Array.isArray(d.websites) ? d.websites.map(String) : [],
      vertical: String(d.vertical || 'UNDEFINED'),
      profilePictureUrl: d.profile_picture_url ? String(d.profile_picture_url) : null,
    },
    name: info.verified_name ? String(info.verified_name) : null,
    nameStatus: info.name_status ? String(info.name_status) : null,
    phone: info.display_phone_number ? String(info.display_phone_number) : c.displayPhone,
    wabaId: c.wabaId,
  };
}

export async function saveWaProfile(p: Omit<WaProfile, 'profilePictureUrl'>) {
  const c = await cfg();
  await call('POST', `${c.phoneNumberId}/whatsapp_business_profile`, c.token, {
    messaging_product: 'whatsapp',
    about: p.about,
    description: p.description,
    address: p.address,
    email: p.email,
    websites: p.websites,
    vertical: p.vertical,
  });
}

// Meta's resumable upload: the handle a profile photo or a template's sample header image takes.
export async function metaUploadHandle(data: Buffer, mime: string): Promise<string> {
  const c = await cfg();
  const appId = env('META_APP_ID');
  if (!appId) throw new WaProfileError('Falta META_APP_ID en Vercel para subir la foto.');
  if (!/^image\/(jpeg|png)$/.test(mime)) throw new WaProfileError('La foto debe ser JPG o PNG.');
  if (data.length > 5 * 1024 * 1024) throw new WaProfileError('La foto debe pesar menos de 5 MB.');
  const session = await call('POST', `${appId}/uploads?file_length=${data.length}&file_type=${encodeURIComponent(mime)}`, c.token);
  if (!session?.id) throw new WaProfileError('Meta no abrió la subida de la foto.');
  const up = await fetch(`${GRAPH()}/${session.id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${c.token}`, file_offset: '0', 'Content-Type': mime },
    body: new Uint8Array(data),
    signal: AbortSignal.timeout(30000),
    cache: 'no-store',
  });
  const u = await up.json().catch(() => ({}));
  if (!up.ok || !u?.h) throw new WaProfileError(u?.error?.message || 'No se pudo subir la foto a Meta.');
  return String(u.h);
}

// New profile photo: Meta's resumable upload gives a handle, and the profile takes that handle.
export async function setWaPhoto(data: Buffer, mime: string) {
  const c = await cfg();
  const h = await metaUploadHandle(data, mime);
  await call('POST', `${c.phoneNumberId}/whatsapp_business_profile`, c.token, { messaging_product: 'whatsapp', profile_picture_handle: h });
}
