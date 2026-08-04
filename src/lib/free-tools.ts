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
}

export const FREE_TOOLS: FreeTool[] = [
  {
    href: '/pregnancy-calculator',
    name: 'Due Date Finder',
    blurb: 'When is your baby coming? Due date, current week and scan dates in one tap.',
    icon: 'baby',
    categories: ['Fertility', "Women's Health"],
  },
  {
    href: '/ovulation-calculator',
    name: 'Fertile Days Finder',
    blurb: 'Your best days to try for a baby this month.',
    icon: 'heart',
    categories: ['Fertility', "Women's Health"],
  },
  {
    href: '/bmi-calculator',
    name: 'Healthy Weight Check',
    blurb: 'Is your weight healthy for your height? Uses the ranges that apply in Pakistan.',
    icon: 'scale',
    categories: ['Wellness', "Men's Health", 'Heart Health'],
  },
  {
    href: '/calorie-calculator',
    name: 'Daily Calorie Check',
    blurb: 'How much should you eat each day to lose, maintain or gain weight?',
    icon: 'flame',
    categories: ['Wellness', "Men's Health", 'Heart Health'],
  },
  {
    href: '/quiz',
    name: 'Routine Finder',
    blurb: 'Two questions, and you get a skincare routine or supplement plan built for you.',
    icon: 'sparkles',
    categories: ['Skincare', 'Makeup', 'Hair'],
  },
];

/** The answers worth showing under a blog post of this category (max two). */
export function answersForCategory(category: string | null | undefined): FreeTool[] {
  if (!category) return [];
  return FREE_TOOLS.filter(t => t.categories.includes(category)).slice(0, 2);
}
