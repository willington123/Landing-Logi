// Encrypts the API keys each store saves (WhatsApp token, Vapi key…) before they go to the database.
// AES-256-GCM with a key derived from INTEGRATIONS_SECRET (or AUTH_SECRET). Changing that secret makes
// the saved keys unreadable: the stores would have to connect again.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

function key(): Buffer {
  const base = (process.env.INTEGRATIONS_SECRET || process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!base) throw new Error('Falta INTEGRATIONS_SECRET o AUTH_SECRET para guardar claves.');
  return createHash('sha256').update(`lp-integrations:${base}`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
}

export function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null; // wrong key or tampered value
  }
}

// "EAAG…xyz9" — enough to recognize a key without showing it.
export const mask = (v: string | null | undefined) => (v ? (v.length > 10 ? `${v.slice(0, 4)}…${v.slice(-4)}` : '••••') : null);

export const randomToken = (bytes = 18) => randomBytes(bytes).toString('base64url');
