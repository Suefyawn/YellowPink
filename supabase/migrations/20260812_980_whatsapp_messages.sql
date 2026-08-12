-- WhatsApp Cloud API message log.
--
-- One row per automated WhatsApp message we send (currently the order
-- confirmation template). Gives the admin a record of what the customer
-- actually received, dedupes re-sends, and records the customer's
-- Confirm / Cancel button tap that arrives later on the webhook.
--
-- Deliberately separate from email_log: different provider, different
-- lifecycle (Meta reports sent → delivered → read), and the button reply
-- has no email equivalent.
create table if not exists public.whatsapp_messages (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references public.orders(id) on delete set null,
  order_number  text,
  phone         text not null,
  template      text,
  -- Meta's wamid, used to match the status callbacks to this row.
  message_id    text unique,
  status        text not null default 'sent'
                check (status in ('sent','delivered','read','failed')),
  error         text,
  -- The customer's quick-reply, once they tap: 'confirm' | 'cancel'.
  reply         text check (reply in ('confirm','cancel')),
  replied_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists whatsapp_messages_order_idx on public.whatsapp_messages (order_id);
create index if not exists whatsapp_messages_created_idx on public.whatsapp_messages (created_at desc);

-- Service-role only: contains customer phone numbers, and every write path
-- (send + webhook) runs server-side. No public policies on purpose.
alter table public.whatsapp_messages enable row level security;

comment on table public.whatsapp_messages is
  'Automated WhatsApp Cloud API messages per order: send result, Meta delivery status, and the customer''s Confirm/Cancel button reply.';
