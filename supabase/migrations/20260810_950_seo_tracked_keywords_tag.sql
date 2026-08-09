-- Segment tag for tracked SEO keywords, powering the rankings page's tag
-- filter and mirroring the Semrush Position Tracking campaign's tags.
-- Written at track time by src/lib/seo-tags.ts (one source of truth for the
-- rules); this migration adds the column and backfills existing rows with
-- the same rules expressed in SQL, in the same first-match-wins order.

alter table public.seo_tracked_keywords
  add column if not exists tag text;

update public.seo_tracked_keywords set tag = case
  when keyword like '%calculator%' then 'health-tools'
  when keyword like '%pregnancy test%' or keyword like '%pregnancy strip%' or keyword like '%pregnancy kit%'
    or keyword like '%check pregnancy%' or keyword like '%ovulation strip%' or keyword like '%ovulation kit%'
    or keyword like '%clearblue%' or keyword like '%digital pregnancy%' then 'pregnancy-tests'
  when keyword like '%ecp%' or keyword like '%postinor%' or keyword like '%levonorgestrel%'
    or keyword like '%emkit%' or keyword like '%famila%' or keyword like '%diane 35%'
    or keyword like '%norethisterone%' or keyword like '%primolut%' or keyword like '%period delay%'
    or keyword like '%periods immediately%' then 'contraception'
  when keyword like '%pcos%' or keyword like '%pcod%' or keyword like '%fibroid%' or keyword like '%miscarriage%'
    or keyword like '%endometriosis%' or keyword like '%leukorrhea%' or keyword like '%amh%'
    or keyword like '%fsh%' or keyword like '%prolactin%' or keyword like '%hormonal%'
    or keyword like '%delayed periods%' or keyword like '%ovarian cyst%' or keyword like '%thyroid%'
    or keyword like '%anemia%' or keyword like '%iron deficiency%' or keyword like '%pregnancy symptoms%'
    or keyword like '%intimate wash%' or keyword like '%rasoli%' or keyword like '%myofolic%'
    or keyword like '%m sol%' or keyword like '%best pcos%' then 'womens-health'
  when keyword like '%whitening%' or keyword like '%sunblock%' or keyword like '%sunscreen%'
    or keyword like '%niacinamide%' or keyword like '%hyaluronic%' or keyword like '%kojic%'
    or keyword like '%azelaic%' or keyword like '%face wash%' or keyword like '%open pores%'
    or keyword like '%korean skincare%' or keyword like '%vitamin c serum%' then 'skincare'
  when keyword like '%folic acid%' or keyword like '%multivitamin%' or keyword like '%collagen%'
    or keyword like '%glutathione%' or keyword like '%fish oil%' or keyword like '%creatine%'
    or keyword like '%magnesium%' or keyword like '%calcium%' or keyword like '%prenatal%'
    or keyword like '%vitamin d%' or keyword like '%vitamin c%' or keyword like '%centrum%'
    or keyword like '%cranberry%' or keyword like '%ferosim%' or keyword like '%semofer%'
    or keyword like '%argivital%' then 'supplements'
  when keyword like '%formula milk%' or keyword like '%lactogen%' or keyword like '%nan milk%'
    or keyword like '%baby milk%' then 'baby'
  when keyword like '%ashwagandha%' or keyword like '%male fertility%' or keyword like '%timing tablets%' then 'mens-health'
  when keyword like '%cough%' or keyword like '%ors%' or keyword like '%bawaseer%'
    or keyword like '%calin g%' or keyword like '%ferti myo%' then 'pharma'
  when keyword like '%nutrifactor%' or keyword like '%saeed ghani%' or keyword like '%rivaj%'
    or keyword like '%conatural%' or keyword like '%elf%' or keyword like '%christine%'
    or keyword like '%cerave%' or keyword like '%laroche%' or keyword like '%la roche%'
    or keyword like '%kiko%' then 'brands'
  else 'other'
end
where tag is null;
