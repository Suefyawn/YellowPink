-- Tier-3 toehold optimisation: strengthen the PCOS canonical PDP (Simfolic).
-- The page was ranking but carried a thin 2-sentence description with no
-- structure; rewrite it into the house format (intro / Supports / Composition
-- / Directions / disclaimer) so the PDP renders proper headings + bullets and
-- the copy is keyword-rich for "PCOS supplement" / "myo-inositol" while staying
-- compliant. "PCOS supplement" stays locked to Simfolic as the single
-- canonical — the Women's-Wellness combo deliberately targets hormonal
-- balance / PMS / menopause instead, so the two don't cannibalise.
update products set description =
'Simfolic pairs 2,000 mg of myo-inositol with 400 mcg of folic acid — a well-studied combination for women managing PCOS and for those planning a pregnancy. Myo-inositol supports insulin sensitivity and ovarian function, the two areas most often disrupted in PCOS, while folic acid covers preconception folate needs.

Supports:
• PCOS care — helps restore regular ovulation and menstrual-cycle balance
• Fertility and egg quality for women trying to conceive
• A healthy insulin response, which underpins hormonal balance in PCOS
• Preconception and early-pregnancy folate intake

Composition: Myo-inositol 2000 mg, folic acid 400 mcg per daily dose.

Directions: Take one dose daily with water, or as advised by your doctor. For PCOS and fertility support, use consistently for at least three months.

Dietary supplement for nutritional support only — not a medicine. Consult your doctor if pregnant, breastfeeding or under treatment.'
where slug = 'simfolic';
