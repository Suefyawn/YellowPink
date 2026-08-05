// One registry for the Quick Answers family, shared by the /answers hub,
// the homepage band, the footer and the blog placements so a new one is
// added in exactly one place. Display names are the friendly, human names
// (owner call: not "X Calculator"); the keyword lives in each page's title
// tag, H1 and blurb, where it does the SEO work.

export interface FreeTool {
  href: string;
  name: string;
  /** One plain sentence a layperson instantly understands. */
  blurb: string;
  /** lucide-style icon path data (24×24, stroke, currentColor). */
  icon: 'heart' | 'baby' | 'scale' | 'flame' | 'sparkles';
  /** Blog categories where this answer earns a "try it yourself" card. */
  categories: string[];
  /** Visual identity: soft background tint + readable accent on it. */
  tint: string;
  accent: string;
  /** Editorial hero image (public path, 1024×768 webp). Quiz has its own page art. */
  image?: string;
}

export const FREE_TOOLS: FreeTool[] = [
  {
    href: '/pregnancy-calculator',
    name: 'Due Date Finder',
    blurb: 'When is your baby coming? Due date, current week and scan dates in one tap.',
    icon: 'baby',
    categories: ['Fertility', "Women's Health"],
    tint: '#fdeee7',
    accent: '#b05a2f',
    image: '/answers/pregnancy.webp',
  },
  {
    href: '/ovulation-calculator',
    name: 'Fertile Days Finder',
    blurb: 'Your best days to try for a baby this month.',
    icon: 'heart',
    categories: ['Fertility', "Women's Health"],
    tint: '#fdf2f8',
    accent: '#be185d',
    image: '/answers/ovulation.webp',
  },
  {
    href: '/bmi-calculator',
    name: 'Healthy Weight Check',
    blurb: 'Is your weight healthy for your height? Uses the ranges that apply in Pakistan.',
    icon: 'scale',
    categories: ['Wellness', "Men's Health", 'Heart Health'],
    tint: '#edf6ee',
    accent: '#2f7d43',
    image: '/answers/bmi.webp',
  },
  {
    href: '/calorie-calculator',
    name: 'Daily Calorie Check',
    blurb: 'How much should you eat each day to lose, maintain or gain weight?',
    icon: 'flame',
    categories: ['Wellness', "Men's Health", 'Heart Health'],
    tint: '#fdf5e0',
    accent: '#9a6a08',
    image: '/answers/calorie.webp',
  },
  {
    href: '/fertility-quiz',
    name: 'Fertility Quiz',
    blurb: 'Four questions point to your most useful next step when a baby is taking its time.',
    icon: 'heart',
    categories: ['Fertility', "Women's Health"],
    tint: '#f6eefb',
    accent: '#8b2fa1',
    image: '/answers/fertility-quiz.webp',
  },
  {
    href: '/quiz',
    name: 'Routine Finder',
    blurb: 'Two questions, and you get a skincare routine or supplement plan built for you.',
    icon: 'sparkles',
    categories: ['Skincare', 'Makeup', 'Hair'],
    tint: '#f3f0fa',
    accent: '#6d4fa1',
    image: '/answers/routine.webp',
  },
];

/** The answers worth showing under a blog post of this category (max two). */
export function answersForCategory(category: string | null | undefined): FreeTool[] {
  if (!category) return [];
  return FREE_TOOLS.filter(t => t.categories.includes(category)).slice(0, 2);
}
