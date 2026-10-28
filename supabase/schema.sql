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
