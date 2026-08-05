// Case-based recommendations for the Quick Answers funnel (owner directive,
// 5 Aug 2026): every calculator/quiz result points to the ONE next step that
// fits that specific result — a product from live inventory or a guide —
// never a generic shelf. House rule stands: a single gentle suggestion per
// result, value first.
//
// Product slugs are verified against live published rows at build time of
// this registry; prices are deliberately NOT duplicated here (the product
// page owns the price).

export interface AnswerRec {
  /** Stable id: which answer + which result case produced this rec. */
  answer: string;
  case: string;
  /** Card copy: why THIS result leads THERE. Plain, layperson sentences. */
  title: string;
  reason: string;
  cta: string;
  href: string;
  /** Product image when the target is a product (catalog path). */
  image?: string;
}

const CATALOG = '/catalog/';

export const ANSWER_RECS: Record<string, AnswerRec> = {
  'ovulation/default': {
    answer: 'ovulation', case: 'default',
    title: 'Ovulation + Pregnancy Test Combo Kit',
    reason: 'The calendar narrows it down; LH strips confirm the exact two days. This kit has 7 ovulation strips for your window and 2 pregnancy strips for two weeks later.',
    cta: 'See the kit',
    href: '/product/ovulation-pregnancy-test-combo-kit',
    image: CATALOG + 'yp-ovulation-pregnancy-combo-kit.webp',
  },
  'ovulation/late': {
    answer: 'ovulation', case: 'late',
    title: 'Pregnancy Test Strips (Pack of 5)',
    reason: 'By these dates your period looks a few days late. A strip with first morning urine settles it in five minutes.',
    cta: 'See the strips',
    href: '/product/pregnancy-test-strips-pack-of-5',
    image: CATALOG + 'yp-pregnancy-test-strips-5.webp',
  },
  'ovulation/irregular': {
    answer: 'ovulation', case: 'irregular',
    title: 'Why cycles run long or short',
    reason: 'Cycles outside 24 to 35 days make calendar estimates unreliable, and PCOS is the most common reason. Start with the guide; ovulation strips beat the calendar for timing.',
    cta: 'Read the guide',
    href: '/blog/delayed-periods-reasons-pakistan',
  },
  'due-date/t1': {
    answer: 'due-date', case: 't1',
    title: 'FOL Chew Chewable Folate',
    reason: 'Folic acid matters most in exactly these first weeks, for the baby’s brain and spine. If you are not on a prenatal yet, start today.',
    cta: 'See the folate',
    href: '/product/fol-chew',
  },
  'due-date/t23': {
    answer: 'due-date', case: 't23',
    title: 'Pregnancy & Prenatal Care Combo',
    reason: 'From the second trimester the baby draws heavily on your iron and calcium. This combo covers the full daily set in one pack.',
    cta: 'See the combo',
    href: '/product/pregnancy-prenatal-care-combo-pack-complete-maternal-health-bundle',
  },
  'bmi/under': {
    answer: 'bmi', case: 'under',
    title: 'Daily Calorie Check',
    reason: 'Healthy weight gain starts with knowing your number: the calorie check gives you a daily target and a protein figure to gain steadily.',
    cta: 'Get your calorie target',
    href: '/calorie-calculator',
  },
  'bmi/over': {
    answer: 'bmi', case: 'over',
    title: 'Daily Calorie Check',
    reason: 'A realistic daily calorie target is the single most useful number for losing weight steadily. It takes ten seconds.',
    cta: 'Get your calorie target',
    href: '/calorie-calculator',
  },
  'calorie/gain': {
    answer: 'calorie', case: 'gain',
    title: 'Nutrifactor Whey Protein',
    reason: 'Hitting a gain target is mostly a protein problem. One scoop adds 24g towards the daily figure above.',
    cta: 'See the protein',
    href: '/product/whey-protein',
  },
  'quiz-fertility/timing': {
    answer: 'quiz-fertility', case: 'timing',
    title: 'Ovulation + Pregnancy Test Combo Kit',
    reason: 'Your answers point to timing, the most fixable factor of all. LH strips find your exact two fertile days; the Fertile Days Finder tells you when to start testing.',
    cta: 'See the kit',
    href: '/product/ovulation-pregnancy-test-combo-kit',
    image: CATALOG + 'yp-ovulation-pregnancy-combo-kit.webp',
  },
  'quiz-fertility/pcos': {
    answer: 'quiz-fertility', case: 'pcos',
    title: 'M-Sol Myo-Inositol Sachets',
    reason: 'Irregular cycles with your pattern of answers often trace back to PCOS. Myo-inositol is the best-studied supplement for restoring ovulation; a gynaecologist visit confirms the picture.',
    cta: 'See M-Sol',
    href: '/product/m-sol-sachet',
  },
  'quiz-fertility/male': {
    answer: 'quiz-fertility', case: 'male',
    title: 'Repro-M Men’s Fertility Supplement',
    reason: 'In about half of couples who wait long, the male side contributes. Repro-M supports sperm count and motility, and a semen analysis is a simple first test.',
    cta: 'See Repro-M',
    href: '/product/repro-m',
  },
  'quiz-fertility/couple': {
    answer: 'quiz-fertility', case: 'couple',
    title: 'Trying-to-Conceive Couple’s Pack',
    reason: 'After a year of trying, work both sides at once and see a fertility specialist without more waiting. The pack pairs Repro-M and Repro-F.',
    cta: 'See the pack',
    href: '/product/couples-conceive-pack',
  },
};

export function recFor(answer: string, resultCase: string): AnswerRec | null {
  return ANSWER_RECS[`${answer}/${resultCase}`] ?? null;
}
