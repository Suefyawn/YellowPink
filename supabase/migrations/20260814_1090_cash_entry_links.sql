-- Migration 1090 — cash entries link to what the money moved for.
--
-- Owner request: a cashbook row should be able to say which order the money
-- came in for, or which vendor it went out to, so "where did this Rs 40,000
-- go?" answers itself months later. Both optional — plenty of movements
-- (fees, capital, packaging) link to nothing. Suggestions (migration 1070)
-- carry these automatically: a settled vendor balance knows its vendor, a
-- reconciled payment knows its order.

alter table public.cash_entries
  add column if not exists order_id  uuid references public.orders(id)  on delete set null,
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

create index if not exists cash_entries_order_idx  on public.cash_entries (order_id)  where order_id  is not null;
create index if not exists cash_entries_vendor_idx on public.cash_entries (vendor_id) where vendor_id is not null;
