-- The Shipping Policy and FAQ CMS pages hard-coded the shipping rate (PKR 200)
-- and free-shipping threshold (PKR 2,500) in their body_html, so they ignored
-- the admin → Settings → Shipping values and had already drifted (the live
-- threshold is PKR 5,000). Replace the hard-coded figures with {{flat_shipping}}
-- and {{free_shipping_threshold}} tokens; the /page/[slug] renderer now
-- substitutes them from the live CommerceConfig, so changing shipping in admin
-- updates these pages everywhere at once.

update pages set body_html = replace(
  replace(body_html, 'PKR 2,500', '{{free_shipping_threshold}}'),
  'PKR 200', '{{flat_shipping}}')
where slug in ('shipping', 'faq')
  and (body_html like '%PKR 200%' or body_html like '%PKR 2,500%');
