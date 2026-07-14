// ============================================================================
// Routine Finder, shared definitions (client + server safe, no imports).
//
// The quiz maps answers to a STRUCTURED routine rather than a category dump:
//   • skincare → a step-by-step routine (cleanse / treat / moisturise / SPF),
//     each step filled by keyword-scoring the live catalogue for the shopper's
//     skin type + concern, with a one-line "why" per pick;
//   • wellness → a small supplement stack (core pick + supporting picks)
//     scored the same way, plus the matching buyer guides from the journal.
//
// Everything here is data: questions, keyword rules, step definitions and
// guide links. The scoring engine that consumes it lives in
// src/app/quiz/actions.ts (server), so this file stays importable from the
// client bundle without dragging Supabase in.
// ============================================================================

export type Branch = 'skincare' | 'wellness';

export interface QuizOption {
  value: string;
  label: string;
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
  { value: 'skincare', label: 'Skincare & beauty', blurb: 'Get a step-by-step routine for your skin' },
  { value: 'wellness', label: 'Health & wellness', blurb: 'Build a supplement plan for your goals' },
];

// ─── Skincare questions ─────────────────────────────────────────────────────
const SKINCARE_QUESTIONS: QuizQuestion[] = [
  {
    key: 'skin_type',
    prompt: 'How would you describe your skin?',
    options: [
      { value: 'dry', label: 'Dry / tight' },
      { value: 'oily', label: 'Oily / shiny' },
      { value: 'combination', label: 'Combination' },
      { value: 'sensitive', label: 'Sensitive / reactive' },
      { value: 'normal', label: 'Normal / balanced' },
    ],
  },
  {
    key: 'concern',
    prompt: 'What would you most like to improve?',
    options: [
      { value: 'acne', label: 'Acne & breakouts' },
      { value: 'pigmentation', label: 'Dark spots & pigmentation' },
      { value: 'dryness', label: 'Dryness & dehydration' },
      { value: 'aging', label: 'Fine lines & firmness' },
      { value: 'dullness', label: 'Dullness & uneven tone' },
      { value: 'sun', label: 'Sun protection' },
    ],
  },
];

// ─── Wellness questions (second question depends on the first) ──────────────
const WELLNESS_GOAL: QuizQuestion = {
  key: 'goal',
  prompt: 'What are you focusing on right now?',
  options: [
    { value: 'womens', label: "Women's health & fertility" },
    { value: 'mens', label: "Men's health & vitality" },
    { value: 'immunity', label: 'Immunity & energy' },
    { value: 'gut', label: 'Digestion & gut health' },
    { value: 'bones', label: 'Bone & joint support' },
    { value: 'kids', label: "Kids' health" },
    { value: 'heart', label: 'Heart health' },
  ],
};

/** Per-goal follow-up so the stack is specific, not a category dump. */
export const WELLNESS_FOCUS: Record<string, QuizQuestion> = {
  womens: {
    key: 'focus',
    prompt: 'Anything specific?',
    options: [
      { value: 'pcos', label: 'PCOS & cycle support' },
      { value: 'pregnancy', label: 'Pregnancy & trying to conceive' },
      { value: 'general', label: 'General daily support' },
    ],
  },
  mens: {
    key: 'focus',
    prompt: 'Anything specific?',
    options: [
      { value: 'vitality', label: 'Energy & vitality' },
      { value: 'fertility', label: 'Fertility support' },
    ],
  },
  immunity: {
    key: 'focus',
    prompt: 'Which sounds more like you?',
    options: [
      { value: 'energy', label: 'Always tired, low energy' },
      { value: 'defense', label: 'Fall sick easily, want stronger immunity' },
    ],
  },
  gut: {
    key: 'focus',
    prompt: 'Which sounds more like you?',
    options: [
      { value: 'bloating', label: 'Gas, bloating & acidity' },
      { value: 'regularity', label: 'Constipation & irregularity' },
    ],
  },
  bones: {
    key: 'focus',
    prompt: 'Anything specific?',
    options: [
      { value: 'joints', label: 'Joint pain & stiffness' },
      { value: 'strength', label: 'Bone strength & calcium' },
    ],
  },
  kids: {
    key: 'focus',
    prompt: 'Anything specific?',
    options: [
      { value: 'iron', label: 'Iron & appetite' },
      { value: 'growth', label: 'Daily vitamins & growth' },
    ],
  },
  heart: {
    key: 'focus',
    prompt: 'Anything specific?',
    options: [
      { value: 'general', label: 'Everyday heart support' },
      { value: 'energy', label: 'Heart health plus energy (CoQ10)' },
    ],
  },
};

/** Questions for a branch given the answers so far (wellness Q2 depends on
 *  the chosen goal). */
export function questionsFor(branch: Branch, answers?: Partial<QuizAnswers>): QuizQuestion[] {
  if (branch === 'skincare') return SKINCARE_QUESTIONS;
  const goal = answers?.goal;
  return goal && WELLNESS_FOCUS[goal] ? [WELLNESS_GOAL, WELLNESS_FOCUS[goal]] : [WELLNESS_GOAL];
}

// ─── Skincare matching rules ────────────────────────────────────────────────
// Products are classified into ONE routine step by the first step whose
// keywords match (priority order below: SPF first so a sun cream never lands
// in "moisturise"). Within a step, products are scored by the shopper's
// concern + skin-type keywords; hits in the product name weigh most.

export interface RoutineStepDef {
  key: string;
  label: string;
  /** What this step does, shown under the step heading. */
  note: string;
  /** A product belongs to this step when any of these appear in its name. */
  match: string[];
}

export const SKINCARE_STEPS: RoutineStepDef[] = [
  {
    key: 'protect', label: 'Protect (AM)',
    note: 'Daily SPF is the one non-negotiable step, especially for pigmentation.',
    match: ['spf', 'sunscreen', 'sun cream', 'sun stick', 'uv '],
  },
  {
    key: 'cleanse', label: 'Cleanse',
    note: 'Morning and night, the base every routine starts from.',
    match: ['cleanser', 'face wash', 'facial wash', 'micellar', 'cleansing'],
  },
  {
    key: 'treat', label: 'Treat',
    note: 'The targeted step that works on your main concern.',
    match: ['serum', 'essence', 'toner', 'ampoule', 'treatment', 'mask', 'spot ', 'exfoli', 'peel'],
  },
  {
    key: 'moisturize', label: 'Moisturise',
    note: 'Seals the routine in, morning and night.',
    match: ['moisturizer', 'moisturiser', 'cream', 'lotion', 'gel', 'balm', 'emulsion'],
  },
];

/** Concern → scoring keywords (matched against name, short and long
 *  description) + the phrase used in the per-pick "why" line. */
export const CONCERN_RULES: Record<string, { label: string; keywords: string[] }> = {
  acne: {
    label: 'acne-prone skin',
    keywords: ['salicylic', 'bha', 'acne', 'blemish', 'niacinamide', 'oil-free', 'foaming', 'tea tree', 'cica', 'centella', 'pore'],
  },
  pigmentation: {
    label: 'dark spots & pigmentation',
    keywords: ['niacinamide', 'vitamin c', 'kojic', 'brighten', 'dark spot', 'tranexamic', 'alpha arbutin', 'glow', 'tone'],
  },
  dryness: {
    label: 'dry, dehydrated skin',
    keywords: ['hyaluronic', 'ceramide', 'hydrat', 'barrier', 'panthenol', 'snail', 'rice', 'moistur'],
  },
  aging: {
    label: 'fine lines & firmness',
    keywords: ['retinol', 'retinal', 'collagen', 'peptide', 'firm', 'anti-aging', 'ginseng', 'elasticity'],
  },
  dullness: {
    label: 'dull, uneven tone',
    keywords: ['vitamin c', 'glow', 'exfoli', 'glycolic', 'aha', 'brighten', 'rice', 'honey', 'radian'],
  },
  sun: {
    label: 'sun protection',
    keywords: ['spf', 'sunscreen', 'uv', 'tone-up'],
  },
};

/** Skin type → smaller scoring nudge so textures suit the skin. */
export const SKIN_TYPE_RULES: Record<string, string[]> = {
  dry: ['hydrat', 'ceramide', 'rich', 'nourish', 'cream'],
  oily: ['gel', 'foaming', 'oil-free', 'light', 'matte', 'niacinamide'],
  combination: ['light', 'balanc', 'gel'],
  sensitive: ['gentle', 'fragrance-free', 'soothing', 'cica', 'centella', 'panthenol', 'relief', 'sensitive'],
  normal: [],
};

// ─── Wellness matching rules ────────────────────────────────────────────────
export const GOAL_CATEGORIES: Record<string, string[]> = {
  womens: ["Women's Health"],
  mens: ["Men's Health"],
  immunity: ['Immunity'],
  gut: ['Digestive & Gut'],
  bones: ['Bone & Joint'],
  kids: ['Kids'],
  heart: ['Heart Health'],
};

/** goal:focus → scoring keywords + the phrase used in "why" lines. */
export const FOCUS_RULES: Record<string, { label: string; keywords: string[] }> = {
  'womens:pcos': { label: 'PCOS & cycle support', keywords: ['inositol', 'pcos', 'folic', 'cycle'] },
  'womens:pregnancy': { label: 'pregnancy & conception', keywords: ['prenatal', 'folic', 'pregnan', 'conceive', 'iron', 'fertility'] },
  'womens:general': { label: 'daily support for women', keywords: ['primrose', 'cranberry', 'multivitamin', 'iron', 'women'] },
  'mens:vitality': { label: 'energy & vitality', keywords: ['ashwagandha', 'vitality', 'performance', 'energy', 'stamina'] },
  'mens:fertility': { label: 'fertility support', keywords: ['fertility', 'repro', 'coq10', 'zinc', 'sperm'] },
  'immunity:energy': { label: 'low energy & fatigue', keywords: ['iron', 'b12', 'b-complex', 'energy', 'fatigue', 'folic'] },
  'immunity:defense': { label: 'stronger immunity', keywords: ['vitamin c', 'zinc', 'immun', 'defense', 'multivitamin'] },
  'gut:bloating': { label: 'gas, bloating & acidity', keywords: ['gas', 'bloat', 'antacid', 'acidity', 'digest', 'enzyme'] },
  'gut:regularity': { label: 'constipation & regularity', keywords: ['fibre', 'fiber', 'constipat', 'psyllium', 'lax'] },
  'bones:joints': { label: 'joint pain & stiffness', keywords: ['joint', 'glucosamine', 'flex', 'collagen', 'stiff'] },
  'bones:strength': { label: 'bone strength', keywords: ['calcium', 'd3', 'vitamin d', 'bone'] },
  'kids:iron': { label: "kids' iron & appetite", keywords: ['iron', 'appetite', 'drops', 'syrup'] },
  'kids:growth': { label: "kids' daily vitamins", keywords: ['multivitamin', 'growth', 'kids', 'daily'] },
  'heart:general': { label: 'everyday heart support', keywords: ['omega', 'fish oil', 'heart', 'cholesterol'] },
  'heart:energy': { label: 'heart health & energy', keywords: ['coq10', 'q10', 'omega', 'heart'] },
};

// ─── Buyer-guide links per result (real journal slugs, checked against
//     production, editorial content so the list is stable). ─────────────────
export const RESULT_GUIDES: Record<string, { slug: string; title: string }[]> = {
  // skincare concerns
  acne: [
    { slug: 'best-face-wash-in-pakistan', title: 'Best Face Wash in Pakistan: How to Choose for Your Skin Type' },
    { slug: 'niacinamide-benefits-how-to-use-skin-pakistan', title: 'Niacinamide: What It Does for Your Skin and How to Use It' },
  ],
  pigmentation: [
    { slug: 'best-pigmentation-melasma-cream-pakistan', title: 'Best Pigmentation & Melasma Creams in Pakistan' },
    { slug: 'kojic-acid-in-pakistan', title: 'Kojic Acid in Pakistan: How to Fade Pigmentation Safely' },
  ],
  dryness: [
    { slug: 'eczema-treatment-pakistan', title: 'Eczema in Pakistan: Triggers & a Gentle Skincare Routine' },
    { slug: 'best-face-wash-in-pakistan', title: 'Best Face Wash in Pakistan: How to Choose for Your Skin Type' },
  ],
  aging: [
    { slug: 'vitamin-e-benefits-skin-hair-pakistan', title: 'Vitamin E: Benefits for Skin, Hair & Overall Health' },
    { slug: 'how-to-use-sheet-masks-pakistan', title: 'How to Use a Sheet Mask: The Complete Guide' },
  ],
  dullness: [
    { slug: 'niacinamide-benefits-how-to-use-skin-pakistan', title: 'Niacinamide: What It Does for Your Skin and How to Use It' },
    { slug: 'how-to-use-sheet-masks-pakistan', title: 'How to Use a Sheet Mask: The Complete Guide' },
  ],
  sun: [
    { slug: 'best-sunscreen-in-pakistan', title: 'Best Sunscreen in Pakistan: SPF Guide + Top Picks' },
    { slug: 'tinted-sunscreen-benefits-pakistan', title: 'Tinted Sunscreen: Why It Beats Plain SPF' },
  ],
  // wellness goal:focus
  'womens:pcos': [
    { slug: 'pcos-symptoms-causes-treatment-pakistan', title: 'What Is PCOS? Signs, Causes and How to Manage It' },
  ],
  'womens:pregnancy': [
    { slug: 'best-prenatal-vitamins-pakistan-guide', title: 'Best Prenatal Vitamins in Pakistan' },
    { slug: 'how-to-get-pregnant-trying-to-conceive-pakistan', title: 'Trying to Conceive: A Practical Guide' },
  ],
  'womens:general': [
    { slug: 'evening-primrose-oil-benefits-pakistan', title: 'Evening Primrose Oil: Benefits for Hormones, PMS & Skin' },
    { slug: 'cranberry-for-uti-recurrent-pakistan', title: 'Cranberry for UTI: Does It Work?' },
  ],
  'mens:vitality': [
    { slug: 'male-infertility-causes-pakistan', title: 'Male Infertility: Common Causes & When to See a Doctor' },
  ],
  'mens:fertility': [
    { slug: 'male-infertility-causes-pakistan', title: 'Male Infertility: Common Causes & When to See a Doctor' },
  ],
  'immunity:energy': [
    { slug: 'iron-deficiency-symptoms-causes-treatment-pakistan', title: 'Iron Deficiency: Signs, Causes and How to Fix It' },
    { slug: 'vitamin-b12-deficiency-symptoms-pakistan', title: 'Vitamin B12 Deficiency: Symptoms & Best Supplements' },
  ],
  'immunity:defense': [
    { slug: 'centrum-alternative-multivitamin-pakistan', title: 'Centrum Alternative: Affordable Daily Multivitamins' },
  ],
  'gut:bloating': [
    { slug: 'best-gastric-stomach-gas-syrup-in-pakistan', title: 'Best Medicine for Stomach Gas & Acidity' },
  ],
  'gut:regularity': [
    { slug: 'constipation-relief-home-remedies-pakistan', title: 'Constipation: Causes, Home Remedies & Fibre That Helps' },
    { slug: 'best-fiber-supplement-in-pakistan', title: 'Best Fibre Supplement in Pakistan' },
  ],
  'bones:joints': [
    { slug: 'rheumatoid-arthritis-symptoms-pakistan', title: 'Rheumatoid Arthritis: Early Symptoms Explained' },
  ],
  'bones:strength': [
    { slug: 'calcium-supplements-how-much-best-time-pakistan', title: 'Calcium Supplements: How Much You Need and When' },
  ],
  'kids:iron': [
    { slug: 'best-iron-supplements-in-pakistan', title: 'Best Iron Supplements: For Adults & Kids Compared' },
  ],
  'kids:growth': [
    { slug: 'baby-colic-causes-remedies-pakistan', title: 'Baby Colic: Causes, Signs & Safe Remedies' },
  ],
  'heart:general': [
    { slug: 'omega-3-fish-oil-benefits-heart-pakistan', title: 'Omega-3 Fish Oil Benefits for Heart Health' },
  ],
  'heart:energy': [
    { slug: 'coq10-benefits-heart-energy-pakistan', title: 'CoQ10: Benefits for Heart, Energy & Statin Users' },
  ],
};

export function guidesForAnswers(answers: QuizAnswers): { slug: string; title: string }[] {
  if (answers.branch === 'skincare') return RESULT_GUIDES[answers.concern] ?? [];
  return RESULT_GUIDES[`${answers.goal}:${answers.focus}`] ?? [];
}

/** Human label for a completed quiz (result heading + email subject). */
export function resultHeadline(answers: QuizAnswers): string {
  if (answers.branch === 'skincare') {
    const c = CONCERN_RULES[answers.concern]?.label;
    return c ? `Your routine for ${c}` : 'Your personalised routine';
  }
  const f = FOCUS_RULES[`${answers.goal}:${answers.focus}`]?.label;
  return f ? `Your plan for ${f}` : 'Your wellness plan';
}
