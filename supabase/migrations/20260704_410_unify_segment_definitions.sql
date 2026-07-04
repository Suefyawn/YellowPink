-- Migration 410 — one segmentation source for Analytics and Segments.
--
-- analytics_rfm_segments (Analytics → Customers tab) classified customers with
-- RELATIVE ntile buckets over the last 365 days, while v_customer_segments
-- (the Segments page) uses ABSOLUTE thresholds over all orders. The same
-- customer landed in contradictory segments — Analytics called someone "At
-- risk" whom Segments called "Engaged", and crowned "Casual" the top segment.
--
-- Re-point the RPC at v_customer_segments so both surfaces read one definition;
-- ntile can never again disagree with the page it links to. Same return shape
-- (segment, customers, total_revenue), so no app change is needed.

create or replace function public.analytics_rfm_segments()
returns table (
  segment text,
  customers bigint,
  total_revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    segment,
    count(*)::bigint                       as customers,
    coalesce(sum(revenue), 0)::numeric     as total_revenue
  from public.v_customer_segments
  group by segment
  order by customers desc;
$$;
-- create or replace preserves existing privileges.
