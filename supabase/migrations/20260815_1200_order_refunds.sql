-- Migration 1200 — order refunds ledger (Shopify's refund record, sized for
-- this store).
--
-- A refund row records money given back on an order without forcing the
-- whole order into `refunded`: partial refunds (one damaged item out of
-- three) keep the order's status while the ledger holds the amount, the
-- items involved, whether stock came back, and who did it. When the refund
-- covers the full total, staff flip the order status to `refunded` as
-- before and the platform revenue rules take over. Finance shows partial
-- refunds as an explicit "Refunds issued" deduction; Analytics stays
-- status-based (documented in the user manual).

create table if not exists public.order_refunds (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  amount     numeric not null check (amount > 0),
  -- Lines refunded: [{id, variant_id, qty, price}] — empty for a flat-amount
  -- refund (e.g. goodwill or shipping-only).
  items      jsonb not null default '[]'::jsonb,
  restocked  boolean not null default false,
  reason     text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists order_refunds_order_idx on public.order_refunds (order_id);

alter table public.order_refunds enable row level security;
-- No policies: service-role only, like every admin table.
