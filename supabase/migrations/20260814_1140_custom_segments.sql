-- Migration 1140 — owner-defined customer segments (Shopify's segment editor,
-- shaped for this store's data).
--
-- The seven fixed buckets in v_customer_segments stay (Analytics still uses
-- them). This adds segments the owner composes from criteria, stored as
-- jsonb and evaluated server-side by segment_customers():
--   { "min_orders": 2, "max_orders": null,
--     "min_revenue": 5000, "max_revenue": null,
--     "ordered_within_days": 90, "not_ordered_within_days": null,
--     "city": "Lahore", "tag_ids": [uuid…],
--     "has_account": true, "bucket": "VIP" }
-- Every key is optional; omitted keys don't filter. Criteria AND together.
-- tag_ids matches customers carrying ANY of the tags. city is a
-- case-insensitive exact match on the customer's most recent order city.
-- bucket matches the fixed v_customer_segments label.
--
-- Used by the Segments admin page (create/preview/count) and the Newsletter
-- audience picker. Service-role only, like the rest of the customer PII.

create table if not exists public.customer_segments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  criteria   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_segments enable row level security;
-- No policies: service-role only, same posture as the other admin tables.

create or replace function public.segment_customers(p_criteria jsonb)
returns table (
  cust_key      text,
  user_id       uuid,
  email         text,
  phone         text,
  city          text,
  orders        bigint,
  revenue       numeric,
  last_order_at timestamptz,
  first_order_at timestamptz,
  segment       text
)
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    -- Most recent order per customer key carries the contact + city we show.
    select distinct on (
      coalesce(
        o.user_id::text,
        lower(o.email),
        nullif(regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g'), '')
      ))
      coalesce(
        o.user_id::text,
        lower(o.email),
        nullif(regexp_replace(coalesce(o.phone, ''), '[^0-9]', '', 'g'), '')
      ) as cust_key,
      o.phone,
      o.city
    from public.orders o
    where o.status not in ('cancelled','payment_pending','payment_failed')
      and o.archived_at is null
    order by 1, o.created_at desc
  )
  select
    s.cust_key,
    s.user_id,
    s.email,
    l.phone,
    l.city,
    s.orders,
    s.revenue,
    s.last_order_at,
    s.first_order_at,
    s.segment
  from public.v_customer_segments s
  left join latest l on l.cust_key = s.cust_key
  where
        (nullif(p_criteria->>'min_orders', '') is null or s.orders  >= (p_criteria->>'min_orders')::int)
    and (nullif(p_criteria->>'max_orders', '') is null or s.orders  <= (p_criteria->>'max_orders')::int)
    and (nullif(p_criteria->>'min_revenue', '') is null or s.revenue >= (p_criteria->>'min_revenue')::numeric)
    and (nullif(p_criteria->>'max_revenue', '') is null or s.revenue <= (p_criteria->>'max_revenue')::numeric)
    and (nullif(p_criteria->>'ordered_within_days', '') is null
         or s.last_order_at >= now() - ((p_criteria->>'ordered_within_days') || ' days')::interval)
    and (nullif(p_criteria->>'not_ordered_within_days', '') is null
         or s.last_order_at < now() - ((p_criteria->>'not_ordered_within_days') || ' days')::interval)
    and (nullif(p_criteria->>'city', '') is null
         or lower(coalesce(l.city, '')) = lower(p_criteria->>'city'))
    and (nullif(p_criteria->>'bucket', '') is null or s.segment = p_criteria->>'bucket')
    and (nullif(p_criteria->>'has_account', '') is null
         or ((p_criteria->>'has_account')::boolean = (s.user_id is not null)))
    and (
      p_criteria->'tag_ids' is null
      or jsonb_array_length(coalesce(p_criteria->'tag_ids', '[]'::jsonb)) = 0
      or exists (
        select 1 from public.customer_tag_map m
        where m.cust_key = s.cust_key
          and m.tag_id in (select (x::text)::uuid from jsonb_array_elements_text(p_criteria->'tag_ids') x)
      )
    )
  order by s.revenue desc, s.last_order_at desc
$$;

revoke all on function public.segment_customers(jsonb) from public, anon, authenticated;
grant execute on function public.segment_customers(jsonb) to service_role;
