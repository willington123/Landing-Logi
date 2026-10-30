// People, accounts (organizations), memberships and invitations. Server-only.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import { rawDb } from '@/lib/server/supabase';
import { MAIN_ORG, forgetMembership } from '@/lib/server/tenant';
import { SESSION_COOKIE, SESSION_DAYS, signSession } from '@/lib/auth';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export type Role = 'owner' | 'admin' | 'member';
export const ROLES: Role[] = ['owner', 'admin', 'member'];

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  session_version: number;
}

const newId = (prefix: string) => `${prefix}_${randomBytes(9).toString('base64url')}`;
export const normalizeEmail = (e: unknown) => String(e ?? '').trim().toLowerCase().slice(0, 160);
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export function passwordProblem(pw: unknown): string | null {
  const p = String(pw ?? '');
  if (p.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (p.length > 200) return 'La contraseña es demasiado larga.';
  return null;
}

// ---------- passwords (scrypt) ----------

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = (stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Slows down guessing: max 10 failed sign-ins per email in 15 minutes (per server instance).
const failures = new Map<string, { n: number; until: number }>();
export function tooManyAttempts(email: string): boolean {
  const f = failures.get(email);
  return Boolean(f && f.until > Date.now() && f.n >= 10);
}
export function noteFailure(email: string) {
  const f = failures.get(email);
  const fresh = !f || f.until < Date.now();
  failures.set(email, { n: fresh ? 1 : f!.n + 1, until: fresh ? Date.now() + 15 * 60000 : f!.until });
  if (failures.size > 5000) failures.clear();
}
export const clearFailures = (email: string) => failures.delete(email);

// ---------- users ----------

export async function countUsers(): Promise<number> {
  const { count, error } = await rawDb().from('app_users').select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const { data, error } = await rawDb().from('app_users').select('*').eq('email', normalizeEmail(email)).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AppUser) || null;
}

export async function getUser(id: string): Promise<AppUser | null> {
  const { data } = await rawDb().from('app_users').select('*').eq('id', id).maybeSingle();
  return (data as AppUser) || null;
}

export async function createUser(input: { email: string; name: string; password: string }): Promise<AppUser> {
  const user = {
    id: newId('usr'),
    email: normalizeEmail(input.email),
    name: String(input.name || '').trim().slice(0, 80) || null,
    password_hash: await hashPassword(input.password),
    session_version: 1,
  };
  const { error } = await rawDb().from('app_users').insert(user);
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Ya existe una cuenta con ese correo. Inicia sesión.' : error.message);
  return user;
}

export async function changePassword(uid: string, current: string, next: string): Promise<AppUser> {
  const user = await getUser(uid);
  if (!user || !(await checkPassword(current, user.password_hash))) throw new Error('La contraseña actual no es correcta.');
  const problem = passwordProblem(next);
  if (problem) throw new Error(problem);
  const v = (user.session_version || 1) + 1; // closes the other open sessions
  const { error } = await rawDb().from('app_users').update({ password_hash: await hashPassword(next), session_version: v }).eq('id', uid);
  if (error) throw new Error(error.message);
  forgetMembership();
  return { ...user, session_version: v };
}

// ---------- organizations ----------

export interface OrgInfo {
  id: string;
  name: string;
  role: Role;
}

export async function createOrg(name: string, id = newId('org')): Promise<string> {
  const { error } = await rawDb().from('organizations').insert({ id, name: name.trim().slice(0, 80) || 'Mi tienda' });
  if (error) throw new Error(error.message);
  return id;
}

export async function renameOrg(id: string, name: string) {
  const { error } = await rawDb().from('organizations').update({ name: name.trim().slice(0, 80) }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addMember(orgId: string, userId: string, role: Role) {
  const { error } = await rawDb().from('memberships').upsert({ org_id: orgId, user_id: userId, role }, { onConflict: 'org_id,user_id' });
  if (error) throw new Error(error.message);
  forgetMembership();
}

export async function userOrgs(uid: string): Promise<OrgInfo[]> {
  const { data: ms, error } = await rawDb().from('memberships').select('org_id, role, created_at').eq('user_id', uid).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!ms?.length) return [];
  const { data: orgs } = await rawDb().from('organizations').select('id, name').in('id', ms.map((m) => m.org_id));
  const names = Object.fromEntries((orgs || []).map((o) => [o.id, o.name]));
  return ms.map((m) => ({ id: m.org_id as string, name: (names[m.org_id] as string) || 'Mi tienda', role: m.role as Role }));
}

export async function roleIn(orgId: string, uid: string): Promise<Role | null> {
  const { data } = await rawDb().from('memberships').select('role').eq('org_id', orgId).eq('user_id', uid).maybeSingle();
  return (data?.role as Role) || null;
}

// ---------- team ----------

export async function listMembers(orgId: string) {
  const { data: ms, error } = await rawDb().from('memberships').select('user_id, role, created_at').eq('org_id', orgId).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!ms?.length) return [];
  const { data: users } = await rawDb().from('app_users').select('id, email, name').in('id', ms.map((m) => m.user_id));
  const byId = Object.fromEntries((users || []).map((u) => [u.id, u]));
  return ms.map((m) => ({ userId: m.user_id as string, role: m.role as Role, email: byId[m.user_id]?.email || '', name: byId[m.user_id]?.name || null, since: m.created_at }));
}

async function ownerCount(orgId: string) {
  const { count } = await rawDb().from('memberships').select('user_id', { count: 'exact', head: true }).eq('org_id', orgId).eq('role', 'owner');
  return count || 0;
}

// actor is the person making the change; admins can't touch owners, and an account always keeps one owner.
export async function setMemberRole(orgId: string, actorRole: Role, userId: string, role: Role) {
  const current = await roleIn(orgId, userId);
  if (!current) throw new Error('Esa persona no está en el equipo.');
  if (actorRole !== 'owner' && (current === 'owner' || role === 'owner')) throw new Error('Solo un dueño puede cambiar a otros dueños.');
  if (current === 'owner' && role !== 'owner' && (await ownerCount(orgId)) <= 1) throw new Error('La cuenta debe tener al menos un dueño.');
  await addMember(orgId, userId, role);
}

export async function removeMember(orgId: string, actorRole: Role, userId: string) {
  const current = await roleIn(orgId, userId);
  if (!current) return;
  if (actorRole !== 'owner' && current === 'owner') throw new Error('Solo un dueño puede quitar a otro dueño.');
  if (current === 'owner' && (await ownerCount(orgId)) <= 1) throw new Error('La cuenta debe tener al menos un dueño.');
  const { error } = await rawDb().from('memberships').delete().eq('org_id', orgId).eq('user_id', userId);
  if (error) throw new Error(error.message);
  forgetMembership();
}

// ---------- invitations (a link the owner shares, valid 7 days) ----------

export interface Invite {
  token: string;
  org_id: string;
  role: Role;
  email: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

export async function createInvite(orgId: string, role: Role, email: string | null, createdBy: string): Promise<Invite> {
  const invite = {
    token: randomBytes(24).toString('base64url'),
    org_id: orgId,
    role,
    email: email ? normalizeEmail(email) : null,
    created_by: createdBy,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    used_at: null,
  };
  const { error } = await rawDb().from('invites').insert(invite);
  if (error) throw new Error(error.message);
  return invite;
}

export async function listInvites(orgId: string): Promise<Invite[]> {
  const { data, error } = await rawDb()
    .from('invites')
    .select('token, org_id, role, email, created_at, expires_at, used_at')
    .eq('org_id', orgId)
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Invite[];
}

export async function revokeInvite(orgId: string, token: string) {
  await rawDb().from('invites').delete().eq('org_id', orgId).eq('token', token);
}

export async function getInvite(token: string): Promise<(Invite & { orgName: string }) | null> {
  if (!/^[\w-]{20,80}$/.test(token || '')) return null;
  const { data } = await rawDb().from('invites').select('token, org_id, role, email, created_at, expires_at, used_at').eq('token', token).maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  const { data: org } = await rawDb().from('organizations').select('name').eq('id', data.org_id).maybeSingle();
  return { ...(data as Invite), orgName: (org?.name as string) || 'una tienda' };
}

export async function useInvite(invite: Invite, userId: string) {
  // Never lower the role of someone already in the account.
  const current = await roleIn(invite.org_id, userId);
  const rank = { owner: 3, admin: 2, member: 1 } as const;
  if (!current || rank[invite.role] > rank[current]) await addMember(invite.org_id, userId, invite.role);
  await rawDb().from('invites').update({ used_at: new Date().toISOString() }).eq('token', invite.token);
}

// ---------- session cookie ----------

export async function withSession(res: NextResponse, user: Pick<AppUser, 'id' | 'session_version'>, orgId: string) {
  res.cookies.set(SESSION_COOKIE, await signSession({ u: user.id, o: orgId, v: user.session_version || 1 }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}

export function signupOpen(): boolean {
  return (process.env.SIGNUP_OPEN || '').trim().toLowerCase() === 'true';
}

export { MAIN_ORG };
