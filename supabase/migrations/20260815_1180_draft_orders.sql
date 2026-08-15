-- Migration 1180 — draft orders (Shopify's Drafts, sized for this store).
--
-- The manual-order form can be saved mid-entry and resumed later: the whole
-- form state goes into payload (items, customer, shipping, discount, notes)
-- exactly as the form components hold it, so resuming is a plain rehydrate.
-- Completing the draft places a real order through the normal path and
-- deletes the row. Service-role only, like every admin table.

create table if not exists public.draft_orders (
  id            uuid primary key default gen_random_uuid(),
  payload       jsonb not null,
  customer_name text,
  note          text,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.draft_orders enable row level security;
-- No policies: service-role only.
