-- Brand landing pages: long-form content + FAQs.
-- The one-paragraph `description` renders in the hero; it is nowhere near
-- enough page for a brand query with six-figure monthly volume ("saeed
-- ghani", 110k/mo, position 19 at the time of this migration). content_html
-- renders as a prose section under the product grid; faqs render as an FAQ
-- list and feed FAQPage JSON-LD.
alter table public.brands add column if not exists content_html text;
alter table public.brands add column if not exists faqs jsonb;

comment on column public.brands.content_html is
  'Staff-authored HTML rendered under the product grid on /brand/<slug>. Same trust model as blog_posts.body (trusted staff input, rendered raw).';
comment on column public.brands.faqs is
  'Array of {"q": string, "a": string}; rendered as an FAQ section and emitted as FAQPage JSON-LD.';
