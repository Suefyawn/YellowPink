-- ============================================================================
-- SERP CTR rewrite for two supplement PDPs that rank on Google page 1 but earn
-- almost no clicks (GSC, 4 Jun-2 Jul):
--   m-sol-sachet : 162 impressions, pos ~6.8, 1.2% CTR
--   repro-m      : 102 impressions, pos ~6.9, 2.9% CTR
-- Both already rank; the title/description just weren't earning the click.
-- Rewrites lead with a "Buy … in Pakistan" commercial hook + price + COD,
-- matching the buyer intent behind the queries they surface for.
-- Idempotent (plain updates by slug).
-- ============================================================================

update public.products set
  seo_title = 'M-Sol Sachet Price in Pakistan | Myo-Inositol for PCOS',
  seo_description = 'Buy M-Sol Myo-Inositol sachets in Pakistan: 2000 mg with folic acid to support ovulation, egg quality and regular cycles in PCOS. Authentic, PKR 1,150, COD.'
where slug = 'm-sol-sachet';

update public.products set
  seo_title = 'Repro-M Male Fertility Supplement Price in Pakistan',
  seo_description = 'Buy Repro-M in Pakistan: maca, L-carnitine, CoQ10 and zinc to support sperm count, motility and male fertility. 100% authentic, PKR 1,300, cash on delivery.'
where slug = 'repro-m';
