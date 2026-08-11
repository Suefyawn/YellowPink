-- Collections get the same long-form content + FAQ treatment as brands
-- (20260811_970). A collection is the natural home for a "hub" page that
-- has to rank for a category query rather than a brand one: the pregnancy
-- test cluster ("pregnancy test", 12,100/mo) is the first of these, where
-- we stock the products and publish the guides but had no page tying them
-- together.
alter table public.collections add column if not exists content_html text;
alter table public.collections add column if not exists faqs jsonb;

comment on column public.collections.content_html is
  'Staff-authored HTML rendered under the product grid on /collection/<slug>. Same trust model as blog_posts.body.';
comment on column public.collections.faqs is
  'Array of {"q": string, "a": string}; rendered as an FAQ section and emitted as FAQPage JSON-LD.';
