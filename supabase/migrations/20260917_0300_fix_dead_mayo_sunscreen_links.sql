-- Semrush site audit, snapshot 15 Sep 2026 (issue 12, broken external
-- links): two guides cite a Mayo Clinic sunscreen article that now returns
-- "Page Not Found" (confirmed in a browser, not just a bot 403). Repointed
-- to the American Academy of Dermatology's Sunscreen FAQs, which makes the
-- same apply-and-reapply point and is live. The third flagged link (WHO
-- EMRO hepatitis paper) loads fine; Semrush was rate-limited, left as is.

begin;

update public.blog_posts set body = replace(body,
  '<a href="https://www.mayoclinic.org/diseases-conditions/skin-cancer/in-depth/sunscreen/art-20045110">Mayo Clinic</a>',
  '<a href="https://www.aad.org/public/everyday-care/sun-protection/sunscreen-patients/sunscreen-faqs">the American Academy of Dermatology</a>'),
  updated_at = now()
where slug = 'tinted-sunscreen-benefits-pakistan';

update public.blog_posts set body = replace(body,
  '<a href="https://www.mayoclinic.org/diseases-conditions/sunburn/in-depth/sunscreen/art-20045110" target="_blank" rel="noreferrer noopener">Mayo Clinic''s guide to sunscreen</a>',
  '<a href="https://www.aad.org/public/everyday-care/sun-protection/sunscreen-patients/sunscreen-faqs" target="_blank" rel="noreferrer noopener">the American Academy of Dermatology''s sunscreen FAQs</a>'),
  updated_at = now()
where slug = 'micellar-water-benefits-how-to-use-pakistan';

commit;
