-- LogiPages: AI confirmation calls with Vapi.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.

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
