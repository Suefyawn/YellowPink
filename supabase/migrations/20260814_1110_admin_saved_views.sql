-- Migration 1110 — saved views for admin lists (Shopify's saved views).
--
-- Any filter combination on a list can be named and pinned as a tab. Views
-- are shared across staff (Shopify shares them per shop, and this team is
-- small); created_by records who made one. `surface` scopes a view to its
-- list ('orders' first; products/customers can adopt later), and `query` is
-- the list's own querystring, applied verbatim on click — the page stays the
-- single owner of what its params mean.

create table if not exists public.admin_saved_views (
  id         uuid primary key default gen_random_uuid(),
  surface    text not null check (surface in ('orders', 'products', 'customers')),
  name       text not null check (length(name) between 1 and 60),
  query      text not null check (length(query) between 1 and 2000),
  created_by text,
  created_at timestamptz not null default now(),
  unique (surface, name)
);

alter table public.admin_saved_views enable row level security;
