-- The archived Yellow Pink cream was PKR 1,999 and genuinely the cheapest
-- thing on these lists. Medicube is 5,999, which makes it the MOST expensive
-- of every list it now appears on (Axis-Y 3,000, Gluthic 3,500, Celimax 4,500,
-- Medicube gel mask 4,780, Anua 5,410, Medicube TXA 5,500). Every inherited
-- "budget" and "most affordable" line is now exactly backwards.
--
-- One ingredient claim is corrected too. A table cell described it as "kojic
-- acid, glutathione and niacinamide in one nightly step", true of the archived
-- cream. Medicube is kojic acid and turmeric, so carrying the old ingredient
-- list across would have invented a formulation.
update public.blog_posts set body =
  replace(replace(replace(body,
    ', the affordable nightly cream most readers start with</li>',
    ', the dedicated kojic acid night cream here, and the priciest of these picks</li>'),
    '<td>The affordable dedicated melasma cream, kojic acid, glutathione and niacinamide in one nightly step</td>',
    '<td>The dedicated melasma cream here, kojic acid and turmeric in one nightly step</td>'),
    'For dedicated melasma care on a budget, the <a class="blog-product-link" href="/product/medicube-kojic-acid-turmeric-vita-capsule-cream">Medicube kojic acid turmeric cream</a>',
    'For a cream aimed squarely at melasma, the <a class="blog-product-link" href="/product/medicube-kojic-acid-turmeric-vita-capsule-cream">Medicube kojic acid turmeric cream</a>'),
  updated_at = now()
where slug = 'best-pigmentation-melasma-cream-pakistan';

update public.blog_posts set body =
  replace(replace(replace(body,
    ', the most affordable cream on this list and the direct answer to the whitening cream search</li>',
    ', the direct answer to the whitening cream search, and the most expensive pick on this list</li>'),
    '<h3 class="wp-block-heading">Yellow Pink Anti-Melasma Cream with Kojic Acid and Glutathione</h3>',
    '<h3 class="wp-block-heading">Medicube Kojic Acid Turmeric Vita Capsule Cream</h3>'),
    'The most direct answer to the whitening cream search, and the most affordable cream on this list at [[price:medicube-kojic-acid-turmeric-vita-capsule-cream]].',
    'The most direct answer to the whitening cream search, at [[price:medicube-kojic-acid-turmeric-vita-capsule-cream]]. It is the most expensive pick here, and the only one built around kojic acid.'),
  updated_at = now()
where slug = 'best-whitening-cream-in-pakistan';

update public.blog_posts set body = replace(body,
  ', the budget night cream for stubborn patches</li>',
  ', the dedicated kojic acid night cream for stubborn patches</li>'), updated_at = now()
where slug = 'whitening-injection-price-pakistan';

update public.blog_posts set body = replace(body,
  ', the budget partner for melasma and stubborn patches</li>',
  ', the kojic acid partner for melasma and stubborn patches</li>'), updated_at = now()
where slug = 'azelaic-acid-benefits-how-to-use-pakistan';

update public.blog_posts set body = replace(body,
  ', the budget night cream for stubborn neck and underarm patches</li>',
  ', the kojic acid night cream for stubborn neck and underarm patches</li>'), updated_at = now()
where slug = 'dark-underarms-whitening-guide-pakistan';
