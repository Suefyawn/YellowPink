// One registry for the free tools, shared by the /tools hub, the homepage
// band and the footer so a new tool is added in exactly one place.

export interface FreeTool {
  href: string;
  name: string;
  /** One plain sentence a layperson instantly understands. */
  blurb: string;
  /** lucide-style icon path data (24×24, stroke, currentColor). */
  icon: 'heart' | 'baby' | 'scale' | 'flame' | 'sparkles';
}

export const FREE_TOOLS: FreeTool[] = [
  {
    href: '/pregnancy-calculator',
    name: 'Pregnancy Calculator',
    blurb: 'See your due date, how many weeks you are today, and your scan dates.',
    icon: 'baby',
  },
  {
    href: '/ovulation-calculator',
    name: 'Ovulation Calculator',
    blurb: 'Find your best days to try for a baby this month.',
    icon: 'heart',
  },
  {
    href: '/bmi-calculator',
    name: 'BMI Calculator',
    blurb: 'Check if your weight is healthy for your height, on the scale that applies in Pakistan.',
    icon: 'scale',
  },
  {
    href: '/calorie-calculator',
    name: 'Calorie Calculator',
    blurb: 'How much to eat each day to lose, maintain or gain weight.',
    icon: 'flame',
  },
  {
    href: '/quiz',
    name: 'Routine Finder',
    blurb: 'Two questions, and you get a skincare routine or supplement plan built for you.',
    icon: 'sparkles',
  },
];
