// Shared bits for the /api/integrations routes.
import Anthropic from '@anthropic-ai/sdk';
import { currentOrgId, currentRole } from '@/lib/server/tenant';
import { GRAPH_VERSION } from '@/lib/server/whatsapp';

export class Forbidden extends Error {
  status = 403;
}

// Connecting or removing keys: owners and admins.
export async function requireManager() {
  const orgId = await currentOrgId();
  const role = await currentRole();
  if (role !== 'owner' && role !== 'admin') throw new Forbidden('Solo el dueño o un administrador pueden cambiar las conexiones.');
  return orgId;
}

const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export async function graphGet(path: string, token: string) {
  const res = await fetch(`${GRAPH}/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Meta respondió HTTP ${res.status}`);
  return data;
}

export async function graphPost(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.error_user_msg || data?.error?.message || `Meta respondió HTTP ${res.status}`);
  return data;
}

const VAPI = (process.env.VAPI_API_BASE_URL || 'https://api.vapi.ai').replace(/\/+$/, '');

// Checks a Vapi key and that the phone number belongs to it.
export async function checkVapi(apiKey: string, phoneNumberId: string) {
  const res = await fetch(`${VAPI}/phone-number/${encodeURIComponent(phoneNumberId)}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Vapi no aceptó la clave privada (Private API Key).');
  if (!res.ok) throw new Error('Vapi no encontró ese número con esta clave. Copia el ID del número desde Vapi → Phone Numbers.');
  return data as { number?: string; provider?: string };
}

// Checks a Claude key with a free call.
export async function checkAnthropic(apiKey: string) {
  try {
    await new Anthropic({ apiKey, maxRetries: 0, timeout: 15_000 }).models.list({ limit: 1 });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new Error('Anthropic no aceptó la clave. Revísala en console.anthropic.com → API Keys.');
    if (e instanceof Anthropic.APIError) throw new Error(`Anthropic respondió con un error (${e.status}). Inténtalo de nuevo.`);
    throw new Error('No se pudo contactar a Anthropic. Inténtalo de nuevo.');
  }
}
