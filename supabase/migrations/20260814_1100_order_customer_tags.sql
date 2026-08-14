-- Migration 1100 — order tags and customer tags (Shopify style).
--
-- Shopify tags orders (rush, exchange, wholesale…) and customers (vip,
-- influencer, prepay-only…) and filters both lists by them. Mirrors the
-- product_tags shape (migration 143): a reusable registry plus a join. The
-- customer join is keyed by the admin's customer identity string (registered
-- auth uuid or the synthesised guest id — the same value that keys the
-- customer page URL), stored as text so guests are first-class.
--
-- Unlike product tags these are admin-only vocabulary — no storefront read,
-- so RLS is enabled with no policies (service-role client only).

create table if not exists public.order_tags (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.order_tag_map (
  order_id   uuid not null references public.orders(id) on delete cascade,
  tag_id     uuid not null references public.order_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (order_id, tag_id)
);
create index if not exists order_tag_map_tag_idx on public.order_tag_map (tag_id);

create table if not exists public.customer_tags (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_tag_map (
  cust_key   text not null,
  tag_id     uuid not null references public.customer_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cust_key, tag_id)
);
create index if not exists customer_tag_map_tag_idx on public.customer_tag_map (tag_id);

alter table public.order_tags       enable row level security;
alter table public.order_tag_map    enable row level security;
alter table public.customer_tags    enable row level security;
alter table public.customer_tag_map enable row level security;
