-- Provenance for orders.acquisition_cost.
--
-- The unified vendor/cost model auto-fills acquisition_cost at vendor
-- dispatch (and on manual-order creation with a vendor) from the shared
-- engine in src/lib/order-costs.ts. This column records where the current
-- value came from:
--   'auto'   — written by the engine (dispatch / manual-order create /
--              "Recalculate from vendor rate"); safe to overwrite on
--              re-dispatch.
--   'manual' — typed by staff in the Order costs card; never clobbered by
--              the auto path.
--   NULL     — no acquisition cost recorded.
alter table public.orders
  add column if not exists acquisition_cost_source text
    check (acquisition_cost_source in ('auto', 'manual'));

comment on column public.orders.acquisition_cost_source is
  'Where acquisition_cost came from: auto (vendor/cost engine) or manual (staff-entered). NULL when acquisition_cost is NULL.';

-- Every pre-existing value was typed by staff (the auto path did not exist).
update public.orders
   set acquisition_cost_source = 'manual'
 where acquisition_cost is not null
   and acquisition_cost_source is null;
