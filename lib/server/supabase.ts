// The Supabase client with the service role key (bypasses RLS). Server-only.
// Most code must use db() from '@/lib/server/db', which limits every query to the current account (organization).
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Accepts both naming styles Supabase uses (dashboard "Connect" snippet and API settings).
const supabaseUrl = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
// Must be the SECRET key (sb_secret_… or the legacy service_role key), never the publishable one.
const supabaseSecret = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();

export function cloudEnabled(): boolean {
  const key = supabaseSecret();
  return Boolean(supabaseUrl() && key && !key.startsWith('sb_publishable_'));
}

let client: SupabaseClient | null = null;

// Unscoped access: only for accounts/sessions, public landing lookups and storage.
export function rawDb(): SupabaseClient {
  if (!cloudEnabled()) throw new Error('Supabase no está configurado (SUPABASE_URL y la clave secreta SUPABASE_SERVICE_ROLE_KEY).');
  if (!client) {
    client = createClient(supabaseUrl(), supabaseSecret(), {
      auth: { persistSession: false, autoRefreshToken: false },
      // Next.js caches fetch() by default; database reads must always be fresh.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
  }
  return client;
}
