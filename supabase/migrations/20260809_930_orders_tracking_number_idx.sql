-- TCS cost reconciliation looks orders up by consignment number in bulk
-- (reconcile-costs.ts). orders.tracking_number had no index — EXPLAIN showed a
-- seq scan per lookup — and the fallback match on shipments.tracking_number
-- could only use the (courier, tracking_number) composite via a skip scan.
-- Partial indexes: NULL tracking numbers (most orders pre-dispatch) are never
-- looked up, so keep them out of the index.

create index if not exists orders_tracking_number_idx
  on public.orders (tracking_number)
  where tracking_number is not null;

create index if not exists shipments_tracking_number_idx
  on public.shipments (tracking_number)
  where tracking_number is not null;
