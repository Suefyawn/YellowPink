-- Canonicalise drifted blog categories onto majority values so the storefront
-- filter and the admin BlogForm dropdown share one taxonomy.
update blog_posts set category = 'Skincare'      where category = 'Beauty & Skincare';
update blog_posts set category = 'Men''s Health'  where category = 'Men Health';
update blog_posts set category = 'Fertility'      where category = 'Fertility Support';
