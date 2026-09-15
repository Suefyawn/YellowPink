-- Three prose mentions the link swap could not reach, because they name the
-- archived products in running text or a spec list rather than in an href.
--
-- 1. A numbered entry whose heading and spec list still described the archived
--    cream: 50g, kojic acid + glutathione + niacinamide. Medicube is 53g,
--    kojic acid and turmeric, with no glutathione, so the "why it works" line
--    was arguing for an ingredient the replacement does not contain.
update public.blog_posts set body =
  replace(replace(replace(replace(body,
    '<h3 class="wp-block-heading">4. Anti-Melasma Cream with Kojic Acid and Glutathione 50g</h3>',
    '<h3 class="wp-block-heading">4. Medicube Kojic Acid Turmeric Vita Capsule Cream 53g</h3>'),
    '<li><strong>Format:</strong> 50 g night cream</li>',
    '<li><strong>Format:</strong> 53 g night cream</li>'),
    '<li><strong>Dose:</strong> Kojic acid, glutathione and niacinamide in a hydrating base</li>',
    '<li><strong>Dose:</strong> Kojic acid and turmeric in a capsule-textured base</li>'),
    '<li><strong>Why it works:</strong> topical glutathione has its own evidence for pigment, and this puts it directly on the patches you want to fade instead of waiting on a tablet.</li>',
    '<li><strong>Why it works:</strong> kojic acid works on pigment where it sits, so it goes directly on the patches you want to fade instead of waiting on a tablet. It is a topical partner to the glutathione above, not a replacement for it.</li>'),
  updated_at = now()
where slug = 'glutathione-benefits-skin-pakistan-guide-2';

-- 2. An unlinked mention selling the archived cream on its aloe content. The
--    NB Sons serum has no aloe, so the claim goes rather than being moved to a
--    product that cannot support it.
update public.blog_posts set body = replace(body,
  ' And if aloe alone leaves your face tight by afternoon, the Medicated Vitamin C Face Cream gives you the same aloe with hyaluronic acid and vitamin E behind it.',
  ' And if aloe alone leaves your face tight by afternoon, layer a moisturiser over it rather than reaching for more gel.'),
  updated_at = now()
where slug = 'aloe-vera-gel-guide-pakistan';

-- 3. The swap left both halves of this answer pointing at the same product at
--    the same price, recommending it against itself. There is no vitamin C
--    cream in the catalogue now, so the dry/sensitive advice becomes advice
--    about how to apply the serum.
update public.blog_posts set body = replace(body,
  'Dry or sensitive skin does better with the Medicated Vitamin C Face Cream at [[price:vitamin-c-serum]], which buffers the same active in a moisturiser.',
  'Dry or sensitive skin does better applying it over a damp face and following with a moisturiser, which buffers the same active without dropping the strength.'),
  updated_at = now()
where slug = 'best-vitamin-c-serum-pakistan';
