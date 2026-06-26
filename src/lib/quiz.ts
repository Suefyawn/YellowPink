// ============================================================================
// Product-finder quiz, shared definitions (client + server safe, no imports).
//
// A combined finder: first pick a path (skincare vs wellness), then a couple
// of quick questions, then we map the answers to live product CATEGORIES and
// recommend matching products. Categories are the canonical labels from
// lib/category-taxonomy (and products.category), so the mapping stays in sync
// with what the store actually sells.
// ============================================================================

export type Branch = 'skincare' | 'wellness';

export interface QuizOption {
  value: string;
  label: string;
  /** Category labels to pull recommendations from when this option is chosen. */
  categories: string[];
}

export interface QuizQuestion {
  key: string;
  prompt: string;
  options: QuizOption[];
}

export interface QuizAnswers {
  branch: Branch;
  // question key → chosen option value
  [key: string]: string;
}

// ─── Branch picker ──────────────────────────────────────────────────────────
export const BRANCHES: { value: Branch; label: string; blurb: string }[] = [
  { value: 'skincare', label: 'Skincare & beauty', blurb: 'Build a routine for your skin' },
  { value: 'wellness', label: 'Health & wellness', blurb: 'Find supplements for your goals' },
];

// ─── Skincare path ──────────────────────────────────────────────────────────
const SKINCARE_QUESTIONS: QuizQuestion[] = [
  {
    key: 'skin_type',
    prompt: 'How would you describe your skin?',
    options: [
      { value: 'dry', label: 'Dry / tight', categories: ['Moisturizers'] },
      { value: 'oily', label: 'Oily / shiny', categories: ['Cleansers & Treatments'] },
      { value: 'combination', label: 'Combination', categories: ['Moisturizers', 'Cleansers & Treatments'] },
      { value: 'sensitive', label: 'Sensitive / reactive', categories: ['Moisturizers'] },
      { value: 'normal', label: 'Normal / balanced', categories: ['Moisturizers'] },
    ],
  },
  {
    key: 'concern',
    prompt: 'What would you most like to improve?',
    options: [
      { value: 'acne', label: 'Acne & breakouts', categories: ['Cleansers & Treatments'] },
      { value: 'pigmentation', label: 'Dark spots & pigmentation', categories: ['Cleansers & Treatments'] },
      { value: 'dryness', label: 'Dryness & dehydration', categories: ['Moisturizers'] },
      { value: 'aging', label: 'Fine lines & firmness', categories: ['Moisturizers', 'Cleansers & Treatments'] },
      { value: 'dullness', label: 'Dullness & uneven tone', categories: ['Cleansers & Treatments'] },
      { value: 'sun', label: 'Sun protection', categories: ['Sunscreens'] },
    ],
  },
];

// ─── Wellness path ──────────────────────────────────────────────────────────
const WELLNESS_QUESTIONS: QuizQuestion[] = [
  {
    key: 'goal',
    prompt: 'What are you focusing on right now?',
    options: [
      { value: 'womens', label: "Women's health & fertility", categories: ["Women's Health"] },
      { value: 'mens', label: "Men's health & vitality", categories: ["Men's Health"] },
      { value: 'immunity', label: 'Immunity & energy', categories: ['Immunity'] },
      { value: 'gut', label: 'Digestion & gut health', categories: ['Digestive & Gut'] },
      { value: 'bones', label: 'Bone & joint support', categories: ['Bone & Joint'] },
      { value: 'kids', label: "Kids' health", categories: ['Kids'] },
      { value: 'heart', label: 'Heart health', categories: ['Heart Health'] },
    ],
  },
];

export function questionsFor(branch: Branch): QuizQuestion[] {
  return branch === 'skincare' ? SKINCARE_QUESTIONS : WELLNESS_QUESTIONS;
}

/** Collapse the chosen answers into a de-duplicated, priority-ordered list of
 *  category labels to source recommendations from. The most specific answer
 *  (the concern / goal) is weighted first. */
export function categoriesForAnswers(answers: QuizAnswers): string[] {
  const branch = answers.branch;
  const qs = questionsFor(branch);
  // Concern/goal (last question) first, then skin type, more specific wins.
  const ordered = [...qs].reverse();
  const cats: string[] = [];
  for (const q of ordered) {
    const chosen = q.options.find(o => o.value === answers[q.key]);
    if (chosen) for (const c of chosen.categories) if (!cats.includes(c)) cats.push(c);
  }
  // Skincare always gets a cleanse+moisturise base so a routine feels complete.
  if (branch === 'skincare') {
    for (const c of ['Cleansers & Treatments', 'Moisturizers']) if (!cats.includes(c)) cats.push(c);
  }
  return cats;
}

/** Human label for a completed quiz (used in the result heading + email). */
export function resultHeadline(answers: QuizAnswers): string {
  return answers.branch === 'skincare'
    ? 'Your personalised skincare picks'
    : 'Your wellness picks';
}
