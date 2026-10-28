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
