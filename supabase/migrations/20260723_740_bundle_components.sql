-- ============================================================================
-- Bundle components: which individual products a bundle/combo product
-- contains, and how many of each.
--
-- Until now a combo was a flat product — the vendor packing an order had no
-- structured list of what's inside, no margin could be computed (component
-- costs vs bundle price), and the storefront couldn't show "what's inside /
-- what you save". This table is the single source for all three:
--   • admin  → bundle pricing panel (margin guardrails, vendor explainer)
--   • orders → vendor WhatsApp message expands bundles into pack lists
--   • PDP    → "What's inside" section with the customer's saving
-- ============================================================================

create table if not exists public.bundle_components (
  bundle_product_id    uuid not null references public.products(id) on delete cascade,
  component_product_id uuid not null references public.products(id) on delete restrict,
  qty                  integer not null default 1 check (qty > 0),
  sort_order           integer not null default 0,
  primary key (bundle_product_id, component_product_id),
  -- A bundle can't contain itself.
  check (bundle_product_id <> component_product_id)
);

create index if not exists bundle_components_component_idx
  on public.bundle_components (component_product_id);

alter table public.bundle_components enable row level security;

-- Storefront needs to read components to render "What's inside" via the anon
-- key. Writes stay service-role only (admin actions).
drop policy if exists bundle_components_public_read on public.bundle_components;
create policy bundle_components_public_read on public.bundle_components
  for select using (true);
