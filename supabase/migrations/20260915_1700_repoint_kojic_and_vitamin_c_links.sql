-- Dead product links, part 3: the two archived Yellow Pink creams.
--
-- 20 of the 23 dead links came from just two products archived before this
-- session: the Anti-Melasma Cream with Kojic Acid (17 articles) and the
-- Medicated Vitamin C Face Cream (3). Replacements, chosen for closest active
-- and closest price among PUBLISHED stock:
--
--   Anti-Melasma Kojic (1,999)  -> Medicube Kojic Acid Turmeric Vita Capsule
--                                  Cream 53g (5,999). Same active, same form.
--   Medicated Vitamin C (1,699) -> NB Sons Vitamin C Brightening Face Serum
--                                  (2,000). Same active, closest price; the
--                                  form changes from cream to serum, which
--                                  20260915_1702 corrects in the prose.
--
-- Anchor text is rewritten alongside the href. Leaving "Anti-Melasma Cream" as
-- the visible link text on a Medicube product page is its own kind of broken,
-- and there were 18 distinct anchor spellings across the two products, so a
-- loop is clearer than 18 hand-written pairs. Longest first: the short anchors
-- are prefixes of the long ones.
do $$
declare
  old_slug text; new_slug text; pair text[]; pairs text[][];
begin
  old_slug := 'anti-melasma-cream-with-kojic-acid';
  new_slug := 'medicube-kojic-acid-turmeric-vita-capsule-cream';
  pairs := array[
    array['Anti-Melasma Cream with Kojic Acid and Glutathione, 50 g', 'Medicube Kojic Acid Turmeric Vita Capsule Cream, 53 g'],
    array['Anti-Melasma Cream with Kojic Acid with Hyaluronic', 'Medicube Kojic Acid Turmeric Vita Capsule Cream'],
    array['Anti-Melasma Cream with Kojic Acid and Glutathione 50g', 'Medicube Kojic Acid Turmeric Vita Capsule Cream 53g'],
    array['Anti-Melasma Cream with Kojic Acid &amp; Glutathione', 'Medicube Kojic Acid Turmeric Vita Capsule Cream'],
    array['Anti-Melasma Cream with Kojic Acid and Glutathione', 'Medicube Kojic Acid Turmeric Vita Capsule Cream'],
    array['Anti-Melasma Cream with Kojic Acid + Glutathione', 'Medicube Kojic Acid Turmeric Vita Capsule Cream'],
    array['Shop Anti-Melasma Cream with Kojic Acid &rarr;', 'Shop Medicube Kojic Acid Turmeric Cream &rarr;'],
    array['kojic acid + glutathione Anti-Melasma Cream', 'Medicube kojic acid turmeric cream'],
    array['Shop the Anti-Melasma Cream &rarr;', 'Shop the Medicube Kojic Acid Turmeric Cream &rarr;'],
    array['kojic and glutathione night cream', 'Medicube kojic acid turmeric cream'],
    array['anti-melasma cream with kojic acid', 'Medicube kojic acid turmeric cream'],
    array['Shop Kojic Acid Cream →', 'Shop Medicube Kojic Acid Turmeric Cream →'],
    array['Shop Anti-Melasma Cream →', 'Shop Medicube Kojic Acid Turmeric Cream →'],
    array['Anti-Melasma Cream', 'Medicube Kojic Acid Turmeric Cream'],
    array['kojic-acid cream', 'Medicube kojic acid cream'],
    array['melasma cream', 'Medicube kojic acid cream']
  ];
  foreach pair slice 1 in array pairs loop
    update public.blog_posts set body = replace(body,
      '/product/' || old_slug || '">' || pair[1] || '</a>',
      '/product/' || new_slug || '">' || pair[2] || '</a>')
    where body like '%' || old_slug || '%';
  end loop;
  update public.blog_posts set body = replace(body, old_slug, new_slug)
  where body like '%' || old_slug || '%';

  old_slug := 'medicated-vitamin-c-cream';
  new_slug := 'vitamin-c-serum';
  pairs := array[
    array['Medicated Vitamin C Face Cream with Hyaluronic Acid &amp; Vitamin E', 'Vitamin C Brightening Face Serum'],
    array['Medicated Vitamin C Face Cream 50g', 'Vitamin C Brightening Face Serum 30ml'],
    array['Medicated Vitamin C Face Cream', 'Vitamin C Brightening Face Serum']
  ];
  foreach pair slice 1 in array pairs loop
    update public.blog_posts set body = replace(body,
      '/product/' || old_slug || '">' || pair[1] || '</a>',
      '/product/' || new_slug || '">' || pair[2] || '</a>')
    where body like '%' || old_slug || '%';
  end loop;
  update public.blog_posts set body = replace(body, old_slug, new_slug)
  where body like '%' || old_slug || '%';
end $$;
