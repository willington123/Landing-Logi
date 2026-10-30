-- LogiPages: plans and payments (Wompi). Run once in Supabase → SQL Editor → New query → Run. Safe to run again.
-- Run it BEFORE publishing the version with plans.

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
