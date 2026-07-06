-- ============================================================================
-- Reviewer topic catalogue: a fixed list of health topics that both blog posts
-- and medical reviewers pick from, so matching a doctor to an article is a
-- direct lookup (article topic ∈ reviewer topics) instead of a keyword guess.
--
-- Schema: blog_posts gets a `topic` (single catalogue label). content_reviewers
-- already has review_topics (text[]); we normalise it onto the catalogue.
--
-- Auto-seed (the "apply it to existing ones based on what we know" part):
--   1. Backfill each post's topic from its category + title keywords.
--   2. Remap existing free-text reviewer topics onto the catalogue labels.
--   3. Infer extra topics from each reviewer's specialty.
--
-- All data steps are guarded / idempotent and no-op on an empty CI database.
-- ============================================================================

alter table public.blog_posts add column if not exists topic text;

-- 1. Backfill article topics (most specific first). Only fill blanks.
update public.blog_posts set topic = case
  when lower(coalesce(title,'') || ' ' || coalesce(category,'')) ~ 'pcos'                              then 'PCOS & hormonal health'
  when lower(coalesce(title,'')) ~ 'pregnan|prenatal|trimester'                                        then 'Prenatal & pregnancy'
  when lower(coalesce(title,'')) ~ 'sperm|male fertility|conceiv|ovulation|folic|ivf|egg quality|fertilit' or lower(coalesce(category,'')) = 'fertility' then 'Fertility & conception'
  when lower(coalesce(category,'')) = 'women''s health'                                                then 'Women''s health'
  when lower(coalesce(category,'')) = 'men''s health' or lower(coalesce(title,'')) ~ 'testosterone|erectile|prostate' then 'Men''s health'
  when lower(coalesce(title,'')) ~ 'sunscreen|spf|sun protection'                                      then 'Sun protection'
  when lower(coalesce(category,'')) = 'skincare'                                                       then 'Skincare'
  when lower(coalesce(category,'')) = 'hair' or lower(coalesce(title,'')) ~ 'hair|scalp|dandruff'      then 'Hair & scalp'
  when lower(coalesce(title,'')) ~ 'bone|joint|calcium|arthritis|osteo'                                then 'Bone & joint'
  when lower(coalesce(title,'')) ~ 'heart|cholesterol|circulation|blood pressure' or lower(coalesce(category,'')) = 'heart health' then 'Heart & circulation'
  when lower(coalesce(title,'')) ~ 'gut|digest|probiotic|constipation|acidity|liver|detox'             then 'Gut & digestion'
  when lower(coalesce(title,'')) ~ 'immun'                                                             then 'Immunity'
  when lower(coalesce(title,'')) ~ 'sleep|melatonin|stress|anxiety|brain|memory|migraine|nerve'        then 'Sleep, stress & brain'
  when lower(coalesce(title,'')) ~ 'weight|diabet|metabol|obesity'                                     then 'Weight & metabolic'
  when lower(coalesce(title,'')) ~ 'baby|infant|child|kids|pediatric|paediatric'                       then 'Children''s health'
  when lower(coalesce(category,'')) = 'wellness'                                                       then 'General nutrition & supplements'
  else null
end
where topic is null;

-- 2. Normalise existing reviewer topics onto the catalogue labels.
with m(from_l, to_l) as (values
  ('hair care','Hair & scalp'), ('hair','Hair & scalp'),
  ('supplements','General nutrition & supplements'), ('supplement','General nutrition & supplements'),
  ('medicine','General nutrition & supplements'), ('medicines','General nutrition & supplements'), ('nutrition','General nutrition & supplements'),
  ('brain health and nervous system','Sleep, stress & brain'), ('brain health','Sleep, stress & brain'), ('sleep','Sleep, stress & brain'),
  ('heart health','Heart & circulation'),
  ('fertility','Fertility & conception'),
  ('pregnancy','Prenatal & pregnancy'), ('prenatal','Prenatal & pregnancy'),
  ('pcos','PCOS & hormonal health'),
  ('digestion','Gut & digestion'), ('gut health','Gut & digestion'),
  ('weight loss','Weight & metabolic'), ('weight management','Weight & metabolic'), ('diabetes','Weight & metabolic'),
  ('women''s health','Women''s health'), ('men''s health','Men''s health'),
  ('bone & joint','Bone & joint'), ('skincare','Skincare'), ('sun protection','Sun protection'),
  ('immunity','Immunity'), ('children''s health','Children''s health'),
  ('general nutrition & supplements','General nutrition & supplements')
)
update public.content_reviewers cr set review_topics = coalesce((
  select array_agg(distinct x) from (
    select coalesce(m.to_l, initcap(t)) as x
    from unnest(cr.review_topics) t
    left join m on lower(replace(t, '’', '''')) = m.from_l
  ) s
), '{}')
where review_topics is not null and array_length(review_topics, 1) > 0;

-- 3. Infer additional topics from specialty (what we already know about them).
update public.content_reviewers set review_topics =
  (select array_agg(distinct e) from unnest(review_topics || array['Women''s health','Fertility & conception','Prenatal & pregnancy']) e)
  where lower(coalesce(specialty,'')) ~ 'gyn|obstet';
update public.content_reviewers set review_topics =
  (select array_agg(distinct e) from unnest(review_topics || array['Sleep, stress & brain']) e)
  where lower(coalesce(specialty,'')) ~ 'neuro';
update public.content_reviewers set review_topics =
  (select array_agg(distinct e) from unnest(review_topics || array['Gut & digestion']) e)
  where lower(coalesce(specialty,'')) ~ 'gastro';
