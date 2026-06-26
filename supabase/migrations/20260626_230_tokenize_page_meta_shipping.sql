-- Migration 228 tokenised only pages.body_html, but the Shipping page's excerpt
-- and meta_description ALSO hard-coded the shipping figures (PKR 200 / PKR 2,500),
-- so the <title>/og:description still showed the stale number. Tokenise those
-- fields too; the /page/[slug] generateMetadata now substitutes the tokens from
-- the live CommerceConfig.
update pages set
  excerpt = replace(replace(excerpt, 'PKR 2,500', '{{free_shipping_threshold}}'), 'PKR 200', '{{flat_shipping}}'),
  meta_description = replace(replace(meta_description, 'PKR 2,500', '{{free_shipping_threshold}}'), 'PKR 200', '{{flat_shipping}}')
where slug in ('shipping', 'faq')
  and (coalesce(excerpt,'') like '%PKR %' or coalesce(meta_description,'') like '%PKR %');
