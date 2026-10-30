// Small helpers for route handlers.
import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/server/tenant';

export const ok = (data: Record<string, unknown> = {}) => NextResponse.json({ success: true, ...data });
export const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status });

// Missing tables (the accounts migration hasn't been run in Supabase yet).
export const migrationMissing = (msg: string) => /app_users|organizations|memberships|invites|org_id/.test(msg) && /exist|schema cache|column/i.test(msg);

export function failFrom(e: any) {
  if (e instanceof AuthError) return fail(e.message, 401);
  const msg = String(e?.message || e);
  if (migrationMissing(msg)) return fail('Falta ejecutar en Supabase el SQL de cuentas (supabase/migrations/004_accounts.sql).', 503, { code: 'migration_missing' });
  return fail(msg, 500);
}
