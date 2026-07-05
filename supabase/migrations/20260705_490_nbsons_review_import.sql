-- ============================================================================
-- Import genuine NB Sons customer reviews (Judge.me on nbsons.com) onto the
-- identical products we sell, to close the zero-social-proof gap that stalls
-- the view->cart step on our house wellness brand.
--
-- These are REAL reviews by real customers, imported verbatim and attributed:
--   * source = 'NB Sons'  -> shown on-page as "via NB Sons" and EXCLUDED from
--     the first-party rich-snippet JSON-LD (Google review policy).
--   * verified_purchase = false -> they didn't buy on Yellow Pink, so no
--     "Verified" badge is claimed.
-- Fulfilment complaints about NB Sons' own shipping were excluded (they are
-- about a different retailer's service, not the product).
-- Idempotent: NOT EXISTS guard lets this re-run (CI from-scratch) safely.
-- ============================================================================

alter table public.product_reviews add column if not exists source text;
comment on column public.product_reviews.source is 'Provenance of an imported review (e.g. ''NB Sons''). NULL = native first-party review left on Yellow Pink.';

insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Anonymous$rv$, 5, $rv$Brilliant$rv$, $rv$2026-04-17 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$artibro$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Anonymous$rv$ and r.body = $rv$Brilliant$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Samina$rv$, 5, $rv$Very Good product$rv$, $rv$2025-09-01 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$artibro$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Samina$rv$ and r.body = $rv$Very Good product$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Afaq Sharif$rv$, 5, $rv$Best Calcium product$rv$, $rv$2025-09-01 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$asco-c$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Afaq Sharif$rv$ and r.body = $rv$Best Calcium product$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Maryam Rana$rv$, 5, $rv$Best product for bone health. Highly recommended$rv$, $rv$2025-09-01 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$calin-g$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Maryam Rana$rv$ and r.body = $rv$Best product for bone health. Highly recommended$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Anonymous$rv$, 5, $rv$Best taste and good product. Highly recommended$rv$, $rv$2025-08-30 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$calosent$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Anonymous$rv$ and r.body = $rv$Best taste and good product. Highly recommended$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$fatima$rv$, 5, $rv$Very good product. The chewable tablets taste pleasant and are easy to take daily. I bought it for immune support and it fits well into my routine.$rv$, $rv$2026-03-05 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$cee$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$fatima$rv$ and r.body = $rv$Very good product. The chewable tablets taste pleasant and are easy to take daily. I bought it for immune support and it fits well into my routine.$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Fatima$rv$, 5, $rv$Highly Recommended , Easy to take$rv$, $rv$2026-03-05 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$cee$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Fatima$rv$ and r.body = $rv$Highly Recommended , Easy to take$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Arif$rv$, 5, $rv$Best Chewable tablet$rv$, $rv$2025-09-01 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$cee$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Arif$rv$ and r.body = $rv$Best Chewable tablet$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Alishba$rv$, 5, $rv$Really helpful for brain$rv$, $rv$2025-09-01 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$citowit$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Alishba$rv$ and r.body = $rv$Really helpful for brain$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Samia yasin$rv$, 5, $rv$Very good for kids$rv$, $rv$2025-08-30 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$f-lium-drops$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Samia yasin$rv$ and r.body = $rv$Very good for kids$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Zainab$rv$, 5, $rv$Amazing Supplement .$rv$, $rv$2026-06-06 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$femeez$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Zainab$rv$ and r.body = $rv$Amazing Supplement .$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$umer khan$rv$, 5, $rv$Amazing Product . i am using it since 2023$rv$, $rv$2026-03-31 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$flex-4$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$umer khan$rv$ and r.body = $rv$Amazing Product . i am using it since 2023$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Soha$rv$, 5, $rv$Amazing product$rv$, $rv$2026-04-14 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$fybosim$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Soha$rv$ and r.body = $rv$Amazing product$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Major Retired Muhammad Bilal$rv$, 5, $rv$The supplements work very well. I am looking forward to using it again.$rv$, $rv$2026-02-26 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$fybosim$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Major Retired Muhammad Bilal$rv$ and r.body = $rv$The supplements work very well. I am looking forward to using it again.$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Zoha$rv$, 3, $rv$After taking the full 30-day supply, I can say that I feel generally more refreshed, and my skin is maybe slightly smoother and better hydrated, particularly compared to other cheaper multivitamin supplements. However, the dramatic anti-aging or "whitening" effects promised in the description weren't visible for me.$rv$, $rv$2025-11-06 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$gluthic$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Zoha$rv$ and r.body = $rv$After taking the full 30-day supply, I can say that I feel generally more refreshed, and my skin is maybe slightly smoother and better hydrated, particularly compared to other cheaper multivitamin supplements. However, the dramatic anti-aging or "whitening" effects promised in the description weren't visible for me.$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Nida Rehman$rv$, 5, $rv$I've been using Gluthic by NB Sons for over a month now, and the results are absolutely remarkable. This is, without a doubt, the best skin supplement I have ever tried. I was initially looking for something to improve overall skin texture and brightness, and Gluthic delivered far beyond my expectations. My skin now has a visible healthy glow, and I've noticed a significant improvement in its firmness and elasticity. Even the fine lines around my eyes seem softer. Highly, highly recommend!$rv$, $rv$2025-11-06 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$gluthic$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Nida Rehman$rv$ and r.body = $rv$I've been using Gluthic by NB Sons for over a month now, and the results are absolutely remarkable. This is, without a doubt, the best skin supplement I have ever tried. I was initially looking for something to improve overall skin texture and brightness, and Gluthic delivered far beyond my expectations. My skin now has a visible healthy glow, and I've noticed a significant improvement in its firmness and elasticity. Even the fine lines around my eyes seem softer. Highly, highly recommend!$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Ahmad Raza$rv$, 5, $rv$I have found it the best Glutathione product till now. It's really helpful for my skin. 🥰$rv$, $rv$2025-08-30 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$gluthic$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Ahmad Raza$rv$ and r.body = $rv$I have found it the best Glutathione product till now. It's really helpful for my skin. 🥰$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Huma Asgar$rv$, 5, $rv$Highly Recommended Combination .$rv$, $rv$2026-03-17 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$gluthic-cee$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Huma Asgar$rv$ and r.body = $rv$Highly Recommended Combination .$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Areen$rv$, 5, $rv$Great service and genuine medicine. Delivery was on time, and the free gift was appreciated. Thank you!$rv$, $rv$2026-06-09 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$meth-d$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Areen$rv$ and r.body = $rv$Great service and genuine medicine. Delivery was on time, and the free gift was appreciated. Thank you!$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Airyy$rv$, 5, $rv$Best product with quick delivery highly recommended$rv$, $rv$2026-06-18 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$puratin$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Airyy$rv$ and r.body = $rv$Best product with quick delivery highly recommended$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Memoona fatima$rv$, 5, $rv$I ordered 2 packs and delivered in a day. Quick service highly recommended$rv$, $rv$2026-06-18 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$puratin$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Memoona fatima$rv$ and r.body = $rv$I ordered 2 packs and delivered in a day. Quick service highly recommended$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Sadia Amin$rv$, 5, $rv$Best product$rv$, $rv$2025-09-03 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$semofer$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Sadia Amin$rv$ and r.body = $rv$Best product$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Hamza Khalid$rv$, 5, $rv$My mother needed to reduce her sugar intake because of health concerns, and finding a good alternative was not easy. We tried a few sweeteners, but many of them had a strange aftertaste. Then we started using Stevoice, and it turned out to be a great choice. The sweetness feels natural and it works really well in her tea, which she drinks every day. She was happy that she could still enjoy her tea without worrying about too much sugar. It has now become a regular part of our kitchen. I would highly recommend Stevoice to anyone who wants a healthier sugar substitute for their family.$rv$, $rv$2026-03-14 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$stevoice$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Hamza Khalid$rv$ and r.body = $rv$My mother needed to reduce her sugar intake because of health concerns, and finding a good alternative was not easy. We tried a few sweeteners, but many of them had a strange aftertaste. Then we started using Stevoice, and it turned out to be a great choice. The sweetness feels natural and it works really well in her tea, which she drinks every day. She was happy that she could still enjoy her tea without worrying about too much sugar. It has now become a regular part of our kitchen. I would highly recommend Stevoice to anyone who wants a healthier sugar substitute for their family.$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Anonymous$rv$, 5, $rv$Great Product$rv$, $rv$2025-11-03 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$stevoice$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Anonymous$rv$ and r.body = $rv$Great Product$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Anonymous$rv$, 5, $rv$Stevoice is a game changer. I have been fond of Sugar much but it's helped me to get rid of, thank you$rv$, $rv$2025-08-30 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$stevoice$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Anonymous$rv$ and r.body = $rv$Stevoice is a game changer. I have been fond of Sugar much but it's helped me to get rid of, thank you$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Samiayasin$rv$, 5, $rv$Highly recommended product$rv$, $rv$2026-03-09 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$syror$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Samiayasin$rv$ and r.body = $rv$Highly recommended product$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Ahmad$rv$, 5, $rv$I have been using it since last month . Amazing results and amazing ingredients , now i feel more relax and stress free. Thanks nbsons$rv$, $rv$2026-06-20 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$trimo-m$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Ahmad$rv$ and r.body = $rv$I have been using it since last month . Amazing results and amazing ingredients , now i feel more relax and stress free. Thanks nbsons$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Ayesha Ali$rv$, 5, $rv$My husband and I had been looking for a natural support supplement for a while. After researching the ingredients in Trimo-M, we decided to give it a try. Within a month, he felt much more energetic and less stressed. It’s great to find a product that uses high-quality herbal extracts like Ashwagandha and Zinc. Highly recommend it to any couple on their fertility journey!$rv$, $rv$2026-03-14 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$trimo-m$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Ayesha Ali$rv$ and r.body = $rv$My husband and I had been looking for a natural support supplement for a while. After researching the ingredients in Trimo-M, we decided to give it a try. Within a month, he felt much more energetic and less stressed. It’s great to find a product that uses high-quality herbal extracts like Ashwagandha and Zinc. Highly recommend it to any couple on their fertility journey!$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Farhan Ali$rv$, 5, $rv$Amazing Experience. Amazing Product . I also suggested it to my friends. Thanks.$rv$, $rv$2026-06-04 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$x-fit$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Farhan Ali$rv$ and r.body = $rv$Amazing Experience. Amazing Product . I also suggested it to my friends. Thanks.$rv$);
insert into public.product_reviews (product_id, author_name, rating, body, created_at, approved, verified_purchase, source)
select p.id, $rv$Uzair Ahmad$rv$, 5, $rv$I’ve been using NB Sons X-Fit for a few weeks now, and honestly, I’m really impressed with the results. It’s easy to take and fits perfectly into my daily routine. I’ve started feeling more active and energized throughout the day, which was something I was really struggling with before. Thanks NB SONS$rv$, $rv$2026-04-04 12:00:00+00$rv$::timestamptz, true, false, 'NB Sons'
from public.products p
where p.slug = $rv$x-fit$rv$
  and not exists (select 1 from public.product_reviews r
                  where r.product_id = p.id and r.source = 'NB Sons'
                    and r.author_name = $rv$Uzair Ahmad$rv$ and r.body = $rv$I’ve been using NB Sons X-Fit for a few weeks now, and honestly, I’m really impressed with the results. It’s easy to take and fits perfectly into my daily routine. I’ve started feeling more active and energized throughout the day, which was something I was really struggling with before. Thanks NB SONS$rv$);
