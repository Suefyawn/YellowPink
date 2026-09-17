-- Give the twelve un-indexed, un-linked guides an inbound link from two
-- indexed guides in the same cluster.
--
-- gsc_url_index_status, 17 Sep 2026: 39 blog URLs sit in "Discovered,
-- currently not indexed" and 10 are unknown to Google. Twelve of them have
-- no <a href="/blog/…"> pointing at them from ANY other post body; the only
-- routes in are the listing pages and the related-posts rail. The 4 Sep audit
-- (item 4) called for exactly this: in-body links from already-indexed posts
-- in the same cluster, then resubmit through the indexing cron.
--
-- One sentence per host, appended as a closing paragraph, two hosts per
-- orphan. Idempotent: a host that already links to the target is skipped.

begin;

create temp table link_plan (host text, target text, sentence text) on commit drop;
insert into link_plan values
-- best-body-wash-in-pakistan
('best-face-wash-in-pakistan',              'best-body-wash-in-pakistan',
 'The same logic applies below the neck: our <a href="/blog/best-body-wash-in-pakistan">body wash guide</a> covers what to use for dry, oily and acne-prone skin on the body.'),
('best-moisturizer-for-dry-skin-pakistan',  'best-body-wash-in-pakistan',
 'Dry skin usually starts in the shower. The <a href="/blog/best-body-wash-in-pakistan">body wash guide</a> covers the washes that do not strip it in the first place.'),
-- birth-control-pills-in-pakistan
('period-delay-tablets-guide-pakistan',     'birth-control-pills-in-pakistan',
 'If you are looking for ongoing cycle control rather than a one-off delay, read the <a href="/blog/birth-control-pills-in-pakistan">birth control pills guide</a>, which covers what is sold in Pakistan and how each type is taken.'),
('irregular-periods-causes-and-treatment-pakistan', 'birth-control-pills-in-pakistan',
 'Doctors often regulate an irregular cycle with the combined pill; the <a href="/blog/birth-control-pills-in-pakistan">birth control pills guide</a> explains the options available here and how to take them.'),
-- c-section-recovery-pakistan
('pregnancy-week-calculator-pakistan',      'c-section-recovery-pakistan',
 'If a caesarean is planned or likely, the <a href="/blog/c-section-recovery-pakistan">C-section recovery guide</a> sets out the first six weeks, stitches, diet and the warning signs to act on.'),
('how-to-increase-breast-milk-supply-pakistan', 'c-section-recovery-pakistan',
 'Supply is often slower to establish after a caesarean; the <a href="/blog/c-section-recovery-pakistan">C-section recovery guide</a> covers feeding positions that protect the wound and what to expect week by week.'),
-- christine-makeup-pakistan-guide
('best-foundation-in-pakistan',             'christine-makeup-pakistan-guide',
 'For a local budget option, the <a href="/blog/christine-makeup-pakistan-guide">Christine makeup guide</a> covers the brand''s foundations and where they fall short.'),
('sheglam-products-guide-pakistan',         'christine-makeup-pakistan-guide',
 'Comparing budget brands? The <a href="/blog/christine-makeup-pakistan-guide">Christine makeup guide</a> covers Pakistan''s own drugstore line and its prices.'),
-- fibroids-symptoms-treatment-pakistan
('ovarian-cyst-symptoms-treatment-pakistan', 'fibroids-symptoms-treatment-pakistan',
 'Cysts are often confused with fibroids (rasoli), which grow in the uterine wall rather than the ovary; the <a href="/blog/fibroids-symptoms-treatment-pakistan">fibroids guide</a> covers how they are told apart and treated.'),
('endometriosis-symptoms-treatment-pakistan', 'fibroids-symptoms-treatment-pakistan',
 'Heavy, painful periods have more than one cause. If an ultrasound mentions rasoli, the <a href="/blog/fibroids-symptoms-treatment-pakistan">uterine fibroids guide</a> explains what that means and the treatment options.'),
-- hirsutism-facial-hair-women-pakistan
('pcos-symptoms-causes-treatment-pakistan', 'hirsutism-facial-hair-women-pakistan',
 'Excess facial or body hair is one of the commonest PCOS signs. The <a href="/blog/hirsutism-facial-hair-women-pakistan">hirsutism guide</a> covers the tests that confirm the cause and the treatments that work.'),
('hair-removal-cream-guide-pakistan',       'hirsutism-facial-hair-women-pakistan',
 'If facial hair is coarse, dark and getting worse, removal creams only treat the surface. The <a href="/blog/hirsutism-facial-hair-women-pakistan">hirsutism guide</a> explains when it is hormonal and what to test.'),
-- luteal-phase-length-symptoms-pakistan and ovulation-kit-how-to-use-price-pakistan
('ovulation-signs-timing-conceive-pakistan', 'luteal-phase-length-symptoms-pakistan',
 'Two related reads: the <a href="/blog/ovulation-kit-how-to-use-price-pakistan">ovulation kit guide</a> on when to test and how to read the strips, and the <a href="/blog/luteal-phase-length-symptoms-pakistan">luteal phase guide</a> on what happens in the two weeks after ovulation.'),
('how-to-get-pregnant-trying-to-conceive-pakistan', 'luteal-phase-length-symptoms-pakistan',
 'To pin the fertile window down precisely, see the <a href="/blog/ovulation-kit-how-to-use-price-pakistan">ovulation kit guide</a>, and for what a short luteal phase means for conceiving, the <a href="/blog/luteal-phase-length-symptoms-pakistan">luteal phase guide</a>.'),
-- menstrual-cup-guide-pakistan
('period-pain-menstrual-cramps-relief-pakistan', 'menstrual-cup-guide-pakistan',
 'Some women find cramps easier with a cup than with pads; the <a href="/blog/menstrual-cup-guide-pakistan">menstrual cup guide</a> covers sizing, safety and cost in Pakistan.'),
('feminine-hygiene-intimate-wash-guide-pakistan', 'menstrual-cup-guide-pakistan',
 'On period products themselves, the <a href="/blog/menstrual-cup-guide-pakistan">menstrual cup guide</a> explains how cups work, how to clean them and whether they suit you.'),
-- milia-white-bumps-on-face-pakistan
('how-to-remove-blackheads-whiteheads-pakistan', 'milia-white-bumps-on-face-pakistan',
 'Hard white bumps that never come to a head are not whiteheads at all; the <a href="/blog/milia-white-bumps-on-face-pakistan">milia guide</a> covers what they are and why squeezing does nothing.'),
('how-to-minimize-open-pores-pakistan',     'milia-white-bumps-on-face-pakistan',
 'If the bumps around your eyes and cheeks are tiny, white and firm, read the <a href="/blog/milia-white-bumps-on-face-pakistan">milia guide</a>; they need a different approach from clogged pores.'),
-- pregnancy-ultrasound-anomaly-scan-pakistan
('pregnancy-week-calculator-pakistan',      'pregnancy-ultrasound-anomaly-scan-pakistan',
 'Once you know your week, the <a href="/blog/pregnancy-ultrasound-anomaly-scan-pakistan">pregnancy ultrasound guide</a> lists which scan is due when, what each checks and what it costs in Pakistan.'),
('folic-acid-pregnancy-pcos-guide-pakistan', 'pregnancy-ultrasound-anomaly-scan-pakistan',
 'Folic acid protects against the neural tube defects the 20-week scan looks for; the <a href="/blog/pregnancy-ultrasound-anomaly-scan-pakistan">anomaly scan guide</a> explains that scan and the others in the schedule.'),
-- timing-tablets-pakistan-guide
('premature-ejaculation-causes-treatment-pakistan', 'timing-tablets-pakistan-guide',
 'On the tablets sold for this, the <a href="/blog/timing-tablets-pakistan-guide">timing tablets guide</a> separates what is evidence-based from what is risky.'),
('ashwagandha-benefits-for-men-pakistan',   'timing-tablets-pakistan-guide',
 'For the stamina claims specifically, the <a href="/blog/timing-tablets-pakistan-guide">timing tablets guide</a> looks at what actually works and the safer route.');

-- One UPDATE ... FROM applies at most one joined row per target row, so a
-- host that carries two sentences (pregnancy-week-calculator) is aggregated
-- first rather than silently losing one.
update public.blog_posts b
set body = b.body || agg.paras,
    updated_at = now()
from (
  select lp.host, string_agg('<p>' || lp.sentence || '</p>', '' order by lp.target) as paras
  from link_plan lp
  join public.blog_posts h on h.slug = lp.host
  where h.body not like '%href="/blog/' || lp.target || '"%'
  group by lp.host
) agg
where b.slug = agg.host;

commit;
