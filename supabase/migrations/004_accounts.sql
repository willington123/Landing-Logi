-- LogiPages: accounts (several stores in one platform).
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.
-- Everything that exists today is kept and becomes the store "org_main" (your store).
-- Run it BEFORE publishing the version with accounts: the current version keeps working after it.

-- ---------- people, stores, memberships, invitations ----------
create table if not exists public.organizations (
  id          text primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.app_users (
  id               text primary key,
  email            text not null unique,
  name             text,
  password_hash    text not null,
  session_version  integer not null default 1,
  created_at       timestamptz not null default now()
);

create table if not exists public.memberships (
  org_id      text not null references public.organizations(id) on delete cascade,
  user_id     text not null references public.app_users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships (user_id);

create table if not exists public.invites (
  token       text primary key,
  org_id      text not null references public.organizations(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
  email       text,
  created_by  text references public.app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists invites_org_idx on public.invites (org_id);

-- Your current store.
insert into public.organizations (id, name) values ('org_main', 'Mi tienda') on conflict (id) do nothing;

-- ---------- every row belongs to a store ----------
-- The default keeps the current version working until the new one is published.
alter table public.landings         add column if not exists org_id text not null default 'org_main' references public.organizations(id);
alter table public.orders           add column if not exists org_id text not null default 'org_main' references public.organizations(id);
alter table public.settings         add column if not exists org_id text not null default 'org_main' references public.organizations(id);
alter table public.wa_conversations add column if not exists org_id text not null default 'org_main' references public.organizations(id);
alter table public.wa_messages      add column if not exists org_id text not null default 'org_main' references public.organizations(id);
alter table public.calls            add column if not exists org_id text not null default 'org_main' references public.organizations(id);

create index if not exists landings_org_idx         on public.landings (org_id);
create index if not exists orders_org_created_idx   on public.orders (org_id, created_at desc);
create index if not exists wa_conversations_org_idx on public.wa_conversations (org_id, last_message_at desc);
create index if not exists wa_messages_org_idx      on public.wa_messages (org_id, conversation_id, created_at desc);
create index if not exists calls_org_idx            on public.calls (org_id, created_at desc);

-- Settings and WhatsApp conversations are keyed per store (two stores can have the same customer phone).
do $$
begin
  if not exists (
    select 1 from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.settings'::regclass and c.contype = 'p' and a.attname = 'org_id'
  ) then
    alter table public.settings drop constraint if exists settings_pkey;
    alter table public.settings add constraint settings_pkey primary key (org_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.wa_conversations'::regclass and c.contype = 'p' and a.attname = 'org_id'
  ) then
    alter table public.wa_messages drop constraint if exists wa_messages_conversation_id_fkey;
    alter table public.wa_conversations drop constraint if exists wa_conversations_pkey;
    alter table public.wa_conversations add constraint wa_conversations_pkey primary key (org_id, id);
    alter table public.wa_messages add constraint wa_messages_conversation_id_fkey
      foreign key (org_id, conversation_id) references public.wa_conversations (org_id, id) on delete cascade;
  end if;
end $$;

-- Same as the other tables: RLS on, no public policies (only the server can read/write).
alter table public.organizations enable row level security;
alter table public.app_users     enable row level security;
alter table public.memberships   enable row level security;
alter table public.invites       enable row level security;
