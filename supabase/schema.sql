-- LogiPages: database schema for Supabase.
-- Run this once in Supabase → SQL Editor → New query → Run.

-- Landings: the full landing config is stored as JSON (images live in Storage).
create table if not exists public.landings (
  id          text primary key,
  slug        text not null unique,
  data        jsonb not null,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Orders placed on public landings (cash on delivery).
create table if not exists public.orders (
  id            text primary key,
  order_number  text not null,
  landing_id    text references public.landings(id) on delete set null,
  data          jsonb not null,
  status        text not null default 'pending_call',
  created_at    timestamptz not null default now()
);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- Store settings (single row with id = 'default').
create table if not exists public.settings (
  id    text primary key,
  data  jsonb not null
);

-- Row Level Security on, with no public policies: only the server (service role key)
-- can read or write. Visitors never talk to the database directly.
alter table public.landings enable row level security;
alter table public.orders   enable row level security;
alter table public.settings enable row level security;

-- Public bucket for landing images (readable by anyone, written only by the server).
insert into storage.buckets (id, name, public)
values ('landing-images', 'landing-images', true)
on conflict (id) do nothing;

-- ---------- WhatsApp (also in migrations/002_whatsapp.sql) ----------
-- One conversation per customer phone (E.164 digits without "+", e.g. 573001234567).
create table if not exists public.wa_conversations (
  id               text primary key,
  name             text,
  last_message     text,
  last_message_at  timestamptz,
  last_inbound_at  timestamptz,
  unread_count     integer not null default 0,
  order_id         text references public.orders(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists wa_conversations_last_message_idx on public.wa_conversations (last_message_at desc);

-- Messages in both directions. wa_message_id is WhatsApp's id (dedupes webhook retries).
create table if not exists public.wa_messages (
  id               text primary key,
  conversation_id  text not null references public.wa_conversations(id) on delete cascade,
  wa_message_id    text unique,
  direction        text not null check (direction in ('in', 'out')),
  type             text not null default 'text',
  body             text not null default '',
  status           text,
  error            text,
  order_id         text references public.orders(id) on delete set null,
  payload          jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists wa_messages_conversation_idx on public.wa_messages (conversation_id, created_at desc);

-- Same as the other tables: RLS on, no public policies (only the server can read/write).
alter table public.wa_conversations enable row level security;
alter table public.wa_messages      enable row level security;

-- ---------- Vapi calls (also in migrations/003_vapi.sql) ----------
-- Call scheduling on each order.
alter table public.orders add column if not exists next_call_at  timestamptz;
alter table public.orders add column if not exists call_attempts integer not null default 0;
create index if not exists orders_next_call_at_idx on public.orders (next_call_at) where next_call_at is not null;

-- One row per call attempt. vapi_call_id links it to the call in Vapi.
create table if not exists public.calls (
  id                 text primary key,
  order_id           text references public.orders(id) on delete cascade,
  vapi_call_id       text unique,
  attempt            integer not null default 1,
  phone              text not null,
  status             text not null default 'queued',
  ended_reason       text,
  outcome            text,
  outcome_notes      text,
  corrected_address  text,
  summary            text,
  transcript         jsonb,
  recording_url      text,
  duration_seconds   integer,
  cost               numeric,
  error              text,
  is_test            boolean not null default false,
  created_at         timestamptz not null default now(),
  started_at         timestamptz,
  ended_at           timestamptz
);
create index if not exists calls_created_at_idx on public.calls (created_at desc);
create index if not exists calls_order_idx on public.calls (order_id);

-- Same as the other tables: RLS on, no public policies (only the server can read/write).
alter table public.calls enable row level security;


-- ---------- Accounts (also in migrations/004_accounts.sql) ----------
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

-- ---------- Plans and payments (also in migrations/005_billing.sql) ----------

-- One subscription per store.
create table if not exists public.subscriptions (
  org_id              text primary key references public.organizations(id) on delete cascade,
  plan                text not null default 'pro',
  status              text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'exempt')),
  trial_ends_at       timestamptz,
  current_period_end  timestamptz,
  auto_renew          boolean not null default false,
  payment_source_id   text,      -- Wompi card saved for automatic monthly charges
  card_brand          text,
  card_last4          text,
  customer_email      text,
  retries             integer not null default 0,
  next_retry_at       timestamptz,
  canceled_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Every payment attempt (Wompi transaction).
create table if not exists public.payments (
  id            text primary key,
  org_id        text not null references public.organizations(id) on delete cascade,
  plan          text not null,
  amount_cents  bigint not null,
  currency      text not null default 'COP',
  reference     text not null unique,
  wompi_id      text,
  status        text not null default 'PENDING',   -- PENDING, APPROVED, DECLINED, VOIDED, ERROR
  method        text,                               -- CARD, PSE, NEQUI, BANCOLOMBIA_TRANSFER…
  kind          text not null default 'checkout',   -- checkout (paid by the store) | auto (monthly charge) | manual (marked by the platform)
  months        integer not null default 1,
  error         text,
  applied_at    timestamptz,                        -- when it extended the subscription
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists payments_org_idx on public.payments (org_id, created_at desc);

-- Platform-wide settings (plans and prices).
create table if not exists public.platform_settings (
  id    text primary key,
  data  jsonb not null
);

-- Your store never pays; the other existing stores start a 7-day trial.
insert into public.subscriptions (org_id, plan, status)
values ('org_main', 'escala', 'exempt')
on conflict (org_id) do nothing;

insert into public.subscriptions (org_id, plan, status, trial_ends_at)
select o.id, 'pro', 'trialing', now() + interval '7 days'
from public.organizations o
where o.id <> 'org_main'
on conflict (org_id) do nothing;

alter table public.subscriptions     enable row level security;
alter table public.payments          enable row level security;
alter table public.platform_settings enable row level security;

-- ---------- appointments (006) ----------
create table if not exists public.appointments (
  id             text primary key,
  org_id         text not null references public.organizations(id) on delete cascade,
  service_id     text not null,
  staff_id       text not null,
  start_at       timestamptz not null,
  end_at         timestamptz not null,
  status         text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  customer_name  text not null default '',
  phone          text not null default '',   -- WhatsApp digits (E.164 without +)
  data           jsonb not null default '{}'::jsonb,  -- notes, source, reminders sent…
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists appointments_org_start_idx on public.appointments (org_id, start_at);
create index if not exists appointments_org_phone_idx on public.appointments (org_id, phone);

alter table public.appointments enable row level security;
