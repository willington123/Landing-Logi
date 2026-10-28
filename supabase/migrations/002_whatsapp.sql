-- LogiPages: WhatsApp inbox (conversations and messages).
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.

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
