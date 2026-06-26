-- Quality pass on published product titles/descriptions (length + local intent).
-- Audit of the 153 published products surfaced: 5 titles > 60 chars (SERP
-- truncation), 3 titles < 30 chars (bare "Buy X in Pakistan"), 6 meta
-- descriptions > 165 chars (truncation), and ~21 titles with no Pakistan/PK
-- purchase-intent keyword. All copy grounded in each product's real name/body.

-- ── A. Trim over-long titles (>60) to <=60 ──
update products set seo_title = 'Asco-C Vitamin C Sachets – Immune & Energy Support (PK)' where slug = 'asco-c';
update products set seo_title = 'Movin Maternal Nutrition for Pregnancy & Lactation (PK)'  where slug = 'movin';
update products set seo_title = 'Nutrifactor Ginseng 250mg — Energy & Focus (PK)'         where slug = 'ginseng';
update products set seo_title = 'Vitamin C Brightening Face Serum – NB Sons (PK)'          where slug = 'vitamin-c-serum';
update products set seo_title = 'Rooposh Feminine Wash – pH-Balanced Intimate Wash (PK)'   where slug = 'rooposh-feminine-wash';

-- ── B. Enrich bare "Buy X in Pakistan" titles (<30) with the real product ──
update products set seo_title = 'Nutrifactor Ginkgo Focus – Ginkgo & Ginseng (Pakistan)' where slug = 'ginkgo-biloba';
update products set seo_title = 'Rivaj UK Waterproof Lip Pencil – Lip Liner (Pakistan)'   where slug = 'lip-liner';
update products set seo_title = 'Nutrifactor Vitamin B12 500mcg – Energy & Nerves (PK)'    where slug = 'vitamin-b12';

-- ── C. Trim over-long meta descriptions (>165) to ~150 ──
update products set seo_description = 'A lightweight Vitamin C facial serum that brightens dull skin, fades dark spots and uneven tone with antioxidant protection. Authentic, COD across Pakistan.' where slug = 'vitamin-c-serum';
update products set seo_description = 'Buy Beauty of Joseon Relief Sun Aqua-Fresh (Rice + B5, SPF50+) in Pakistan — lightweight watery Korean sunscreen, no white cast, ideal for oily skin.' where slug = 'beauty-of-joseon-relief-sun-aqua-fresh-rice-b5-spf50';
update products set seo_description = 'Kidogest herbal colic drops for infants — cumin, fennel, peppermint, ginger & cardamom to ease gas, bloating and tummy discomfort. COD across Pakistan.' where slug = 'kidogest-drops';
update products set seo_description = 'A gentle, hydrating daily face wash that lifts away dirt, oil and impurities without stripping skin, leaving it soft and fresh. COD across Pakistan.' where slug = 'hydrating-face-wash';
update products set seo_description = 'Rooposh is a soap-free, pH-balanced feminine intimate wash for daily freshness that respects your body''s natural balance. Authentic, COD across Pakistan.' where slug = 'rooposh-feminine-wash';
update products set seo_description = 'Buy the original Beauty of Joseon Relief Sun (Rice + Probiotics, SPF50+) in Pakistan — viral Korean sunscreen: lightweight, hydrating, no white cast.' where slug = 'beauty-of-joseon-relief-sun-rice-probiotics-spf50';

-- ── D. Add Pakistan geo-intent to titles that lack it and have headroom ──
-- Runs last so the rows fixed in A/B (now containing PK) are excluded. Skips
-- titles already ending in a brand suffix ("… – NB Sons"). length<=47 keeps the
-- result (+ " – Pakistan", 11 chars) at <=58.
update products
set seo_title = seo_title || ' – Pakistan'
where status = 'published'
  and seo_title !~* '\ypakistan\y|\ypk\y|\yprice\y|\ybuy\y'
  and length(seo_title) <= 47
  and seo_title not like '%NB Sons';
