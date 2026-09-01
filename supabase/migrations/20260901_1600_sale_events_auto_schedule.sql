-- Occasions autopilot (owner ask, 1 Sep 2026): each sale_events row can run
-- by itself over its stored window every cycle. The storefront resolver
-- (src/lib/preview-look.ts + pickAutoEvent in src/lib/sale-events.ts)
-- overlays the picked event as an armed schedule; this flag lets the owner
-- take any occasion off the calendar without deleting it.
alter table public.sale_events
  add column if not exists auto_schedule boolean not null default true;
