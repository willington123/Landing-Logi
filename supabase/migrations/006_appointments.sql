-- Konnexa: appointments ("Negocio con citas": barberías, consultorios, spas…).
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again. Run it BEFORE publishing the agenda version.
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
