// Rule-based segment tag for a tracked SEO keyword. One source of truth for
// the tag written at track time (seo-rankings action), the DB backfill, and
// the Semrush Position Tracking import CSV — keep the rules in sync with that
// campaign's tags so the two dashboards slice the same way.
//
// Order matters: earlier rules win (e.g. "pregnancy test strips price in
// pakistan" is pregnancy-tests, not supplements).

export type SeoTag =
  | 'health-tools' | 'pregnancy-tests' | 'contraception' | 'womens-health'
  | 'skincare' | 'supplements' | 'baby' | 'mens-health' | 'pharma' | 'brands' | 'other';

const RULES: Array<[SeoTag, string[]]> = [
  ['health-tools', ['calculator']],
  ['pregnancy-tests', ['pregnancy test', 'pregnancy strip', 'pregnancy kit', 'check pregnancy', 'ovulation strip', 'ovulation kit', 'clearblue', 'digital pregnancy']],
  ['contraception', ['ecp', 'postinor', 'levonorgestrel', 'emkit', 'famila', 'diane 35', 'norethisterone', 'primolut', 'period delay', 'periods immediately']],
  ['womens-health', ['pcos', 'pcod', 'fibroid', 'miscarriage', 'endometriosis', 'leukorrhea', 'amh', 'fsh', 'prolactin', 'hormonal', 'delayed periods', 'ovarian cyst', 'thyroid', 'anemia', 'iron deficiency', 'pregnancy symptoms', 'intimate wash', 'rasoli', 'myofolic', 'm sol', 'best pcos']],
  ['skincare', ['whitening', 'sunblock', 'sunscreen', 'niacinamide', 'hyaluronic', 'kojic', 'azelaic', 'face wash', 'open pores', 'korean skincare', 'vitamin c serum']],
  ['supplements', ['folic acid', 'multivitamin', 'collagen', 'glutathione', 'fish oil', 'creatine', 'magnesium', 'calcium', 'prenatal', 'vitamin d', 'vitamin c', 'centrum', 'cranberry', 'ferosim', 'semofer', 'argivital']],
  ['baby', ['formula milk', 'lactogen', 'nan milk', 'baby milk']],
  ['mens-health', ['ashwagandha', 'male fertility', 'timing tablets']],
  ['pharma', ['cough', 'ors', 'bawaseer', 'calin g', 'ferti myo']],
  ['brands', ['nutrifactor', 'saeed ghani', 'rivaj', 'conatural', 'elf', 'christine', 'cerave', 'laroche', 'la roche', 'kiko']],
];

export function tagForKeyword(keyword: string): SeoTag {
  const k = keyword.toLowerCase();
  for (const [tag, needles] of RULES) {
    if (needles.some(n => k.includes(n))) return tag;
  }
  return 'other';
}

/** True when the keyword carries buying intent — used for the buy-intent
 *  highlight, matching the Position Tracking campaign's second tag. */
export function isBuyIntent(keyword: string): boolean {
  const k = keyword.toLowerCase();
  return k.includes('price in pakistan') || k.startsWith('best ');
}
