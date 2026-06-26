-- Remove em-dash (—) and en-dash (–) from all customer-facing content. The
-- spaced dash is a well-known "AI writing" tell and was over-used across titles,
-- descriptions and blog copy. Replacement rules (applied per field, NULL-safe):
--   • &mdash; → ", "   &ndash; → "-"   (HTML entities used in imported copy)
--   • digit–digit (numeric ranges) → digit-digit  (e.g. "200–400" → "200-400")
--   • " — " / " – " (spaced) → ", "               (clause breaks → comma)
--   • any remaining em/en dash → "-"
-- A matching code change converts the hard-coded category/taxon copy and the
-- "— Shop" title format.

-- Reusable shape is inlined per field via a CASE guard so NULLs and dash-free
-- rows are left untouched.

update products set
  name = case when name ~ '[–—]' then regexp_replace(regexp_replace(regexp_replace(name,'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else name end,
  seo_title = case when seo_title ~ '[–—]' or seo_title like '%&mdash;%' or seo_title like '%&ndash;%' then regexp_replace(regexp_replace(regexp_replace(replace(replace(seo_title,'&mdash;',', '),'&ndash;','-'),'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else seo_title end,
  seo_description = case when seo_description ~ '[–—]' or seo_description like '%&mdash;%' or seo_description like '%&ndash;%' then regexp_replace(regexp_replace(regexp_replace(replace(replace(seo_description,'&mdash;',', '),'&ndash;','-'),'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else seo_description end
where name ~ '[–—]' or seo_title ~ '[–—]' or seo_description ~ '[–—]'
   or seo_title like '%&mdash;%' or seo_title like '%&ndash;%'
   or seo_description like '%&mdash;%' or seo_description like '%&ndash;%';

update blog_posts set
  title = case when title ~ '[–—]' then regexp_replace(regexp_replace(regexp_replace(title,'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else title end,
  excerpt = case when excerpt ~ '[–—]' then regexp_replace(regexp_replace(regexp_replace(excerpt,'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else excerpt end,
  body = case when body ~ '[–—]' or body like '%&mdash;%' or body like '%&ndash;%' then regexp_replace(regexp_replace(regexp_replace(replace(replace(body,'&mdash;',', '),'&ndash;','-'),'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else body end
where title ~ '[–—]' or excerpt ~ '[–—]' or body ~ '[–—]' or body like '%&mdash;%' or body like '%&ndash;%';

update brands set
  description = case when description ~ '[–—]' or description like '%&mdash;%' or description like '%&ndash;%' then regexp_replace(regexp_replace(regexp_replace(replace(replace(description,'&mdash;',', '),'&ndash;','-'),'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else description end,
  seo_title = case when seo_title ~ '[–—]' then regexp_replace(regexp_replace(regexp_replace(seo_title,'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else seo_title end
where description ~ '[–—]' or seo_title ~ '[–—]' or description like '%&mdash;%' or description like '%&ndash;%';

update pages set
  title = case when title ~ '[–—]' then regexp_replace(regexp_replace(regexp_replace(title,'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else title end,
  excerpt = case when excerpt ~ '[–—]' or excerpt like '%&mdash;%' or excerpt like '%&ndash;%' then regexp_replace(regexp_replace(regexp_replace(replace(replace(excerpt,'&mdash;',', '),'&ndash;','-'),'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else excerpt end,
  meta_title = case when meta_title ~ '[–—]' then regexp_replace(regexp_replace(regexp_replace(meta_title,'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else meta_title end,
  meta_description = case when meta_description ~ '[–—]' then regexp_replace(regexp_replace(regexp_replace(meta_description,'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else meta_description end,
  body_html = case when body_html ~ '[–—]' or body_html like '%&mdash;%' or body_html like '%&ndash;%' then regexp_replace(regexp_replace(regexp_replace(replace(replace(body_html,'&mdash;',', '),'&ndash;','-'),'(\d)\s*[–—]\s*(\d)','\1-\2','g'),'\s+[–—]\s+',', ','g'),'[–—]','-','g') else body_html end
where title ~ '[–—]' or excerpt ~ '[–—]' or body_html ~ '[–—]' or meta_title ~ '[–—]' or meta_description ~ '[–—]'
   or body_html like '%&mdash;%' or body_html like '%&ndash;%' or excerpt like '%&mdash;%' or excerpt like '%&ndash;%';
