// The fixed catalogue of health/wellness topics the store writes about and
// that medical reviewers can cover. This is the single source of truth for:
//   * the topic checkboxes on a reviewer's profile (admin + self-service),
//   * the topic picker on a blog post,
//   * the direct reviewer↔article match (article topic ∈ reviewer topics).
//
// Keep it a small, stable list. Adding a topic here makes it selectable
// everywhere at once; renaming one means re-tagging (labels are the stored
// value), so prefer adding over renaming.

export const REVIEW_TOPICS = [
  "Women's health",
  'Fertility & conception',
  'Prenatal & pregnancy',
  'PCOS & hormonal health',
  "Men's health",
  'Skincare',
  'Sun protection',
  'Hair & scalp',
  'Bone & joint',
  'Heart & circulation',
  'Gut & digestion',
  'Immunity',
  'Sleep, stress & brain',
  'Weight & metabolic',
  "Children's health",
  'General nutrition & supplements',
] as const;

export type ReviewTopic = (typeof REVIEW_TOPICS)[number];

const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

// Canonicalise an arbitrary stored/typed topic string to a catalogue label,
// so legacy free-text topics ("Hair Care", "Supplements", "Medicine") and
// case/apostrophe variants resolve to the fixed list. Returns null when it
// doesn't map to anything we recognise.
const ALIASES: Record<string, ReviewTopic> = {
  'hair care': 'Hair & scalp',
  'hair': 'Hair & scalp',
  'supplements': 'General nutrition & supplements',
  'supplement': 'General nutrition & supplements',
  'medicine': 'General nutrition & supplements',
  'medicines': 'General nutrition & supplements',
  'nutrition': 'General nutrition & supplements',
  'brain health and nervous system': 'Sleep, stress & brain',
  'brain health': 'Sleep, stress & brain',
  'sleep': 'Sleep, stress & brain',
  'heart health': 'Heart & circulation',
  'fertility': 'Fertility & conception',
  'pregnancy': 'Prenatal & pregnancy',
  'prenatal': 'Prenatal & pregnancy',
  'pcos': 'PCOS & hormonal health',
  'digestion': 'Gut & digestion',
  'gut health': 'Gut & digestion',
  'weight loss': 'Weight & metabolic',
  'weight management': 'Weight & metabolic',
  'diabetes': 'Weight & metabolic',
  'kids': "Children's health",
  'child health': "Children's health",
};

export function canonicalTopic(input: string | null | undefined): ReviewTopic | null {
  if (!input) return null;
  const n = norm(input);
  const exact = REVIEW_TOPICS.find(t => norm(t) === n);
  if (exact) return exact;
  return ALIASES[n] ?? null;
}

/** Canonicalise a list, dropping unknowns and de-duplicating. */
export function canonicalTopics(list: (string | null | undefined)[]): ReviewTopic[] {
  const out: ReviewTopic[] = [];
  for (const item of list) {
    const c = canonicalTopic(item);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}
