-- Migration 1080 — order timeline comments + customer notes.
--
-- Shopify's order timeline interleaves events with staff comments, and its
-- customer page carries a note. Ours had neither home: order_events records
-- status transitions only (to_status NOT NULL) and orders.notes is one
-- overwritable textarea with no author or history. Call-attempt logs
-- ("rang twice, trying evening") and customer facts ("always call before
-- 6pm", "prepay only") get real, append-only storage.

create table if not exists public.order_comments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  author     text not null,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists order_comments_order_idx on public.order_comments (order_id, created_at);

-- Keyed by the same customer identity the admin uses (registered user id or
-- guest identifier), stored as text so guests are first-class.
create table if not exists public.customer_notes (
  id         uuid primary key default gen_random_uuid(),
  cust_key   text not null,
  author     text not null,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists customer_notes_key_idx on public.customer_notes (cust_key, created_at);

-- Admin-only: RLS on with no policies → service-role client only.
alter table public.order_comments enable row level security;
alter table public.customer_notes enable row level security;
