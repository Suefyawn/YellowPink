-- Phase 4 (Finance / P&L): an expenses ledger for ad spend + overheads, and
-- per-order cost columns so profit can be netted out per order and in total.

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  incurred_on date not null default current_date,
  -- 'Ads' | 'Courier/Delivery' | 'Payment fees' | 'Packaging' | 'Salaries' | 'Other'
  category    text not null,
  -- For Ads: the channel ('Meta','Google','TikTok',...). NULL for non-ad rows.
  channel     text,
  amount      numeric not null check (amount >= 0),
  note        text,
  created_at  timestamptz not null default now()
);

-- Admin-only data: RLS on with no policy → anon/authenticated get nothing; the
-- admin reads/writes via the service-role client (same pattern as audit_log,
-- vendors, etc.).
alter table public.expenses enable row level security;
create index if not exists expenses_incurred_on_idx on public.expenses(incurred_on);
create index if not exists expenses_category_idx     on public.expenses(category);

-- Per-order costs (what we pay the courier + payment-gateway fee). Nullable;
-- entered by staff on the order page. Vendor cost already lives on
-- vendor_settlements; these complete the per-order margin.
alter table public.orders
  add column if not exists delivery_cost numeric,
  add column if not exists payment_fee   numeric;
