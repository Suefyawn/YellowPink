-- ============================================================================
-- WhatsApp click log.
--
-- Storefront "Chat / Order on WhatsApp" buttons now route through the internal
-- /go/whatsapp redirect (so SEO crawlers never probe wa.me — see robots.txt +
-- src/lib/whatsapp.ts). That redirect records each click here, turning
-- WhatsApp-order intent (a big, previously-invisible slice of this store's
-- conversions) into a measurable funnel step surfaced on Analytics → Sources.
--
-- No PII: only where the click came from. Service-role only (the redirect route
-- writes with the service role; admin analytics reads with it). RLS on with no
-- policy = deny anon/authenticated.
-- ============================================================================

create table if not exists public.whatsapp_clicks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  src          text,          -- where the button was (fab / pdp / cart / contact)
  path         text,          -- referring storefront path, if sent
  product_slug text           -- product context, when clicked from a PDP
);

create index if not exists whatsapp_clicks_created_at_idx
  on public.whatsapp_clicks (created_at desc);

alter table public.whatsapp_clicks enable row level security;
