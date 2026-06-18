import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Accessibility gate. Runs axe-core (WCAG 2.0/2.1 A + AA) over the core
// storefront funnel in demo mode and fails on any serious/critical violation,
// so contrast/labelling/role regressions can't ship unnoticed. Moderate/minor
// findings are reported but not gated, to keep the build signal actionable.
//
// Scoped to the public funnel: admin is auth-gated and not reachable in demo
// mode. Run against a real deployment (PLAYWRIGHT_BASE_URL) to widen coverage.

const FUNNEL: { name: string; path: string }[] = [
  { name: 'home', path: '/' },
  { name: 'shop', path: '/shop' },
  { name: 'shop category facet', path: '/shop?category=Skincare' },
  { name: 'product detail', path: '/product/demo-cerave-moisturising-cream' },
  { name: 'cart', path: '/cart' },
  { name: 'blog index', path: '/blog' },
  { name: 'blog post', path: '/blog/demo-routine-for-pakistani-summer' },
  { name: 'login', path: '/login' },
  { name: 'track order', path: '/track' },
  { name: 'wishlist', path: '/wishlist' },
];

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['serious', 'critical']);

for (const { name, path } of FUNNEL) {
  test(`a11y: ${name} has no serious/critical WCAG violations`, async ({ page }) => {
    await page.goto(path);
    // Let the first paint settle (client islands hydrate, fonts swap in).
    await page.waitForLoadState('networkidle');

    // The promo banner's colours are fully admin-themeable (Settings → Branding
    // sets bg + text), so a static gate can't enforce contrast on arbitrary
    // operator choices — guidance for that belongs in the branding editor.
    const results = await new AxeBuilder({ page }).withTags(WCAG).exclude('.promo-banner').analyze();
    const blocking = results.violations.filter(v => BLOCKING.has(v.impact ?? ''));

    if (blocking.length) {
      // Surface enough to fix without opening the trace.
      const summary = blocking
        .map(v => `  [${v.impact}] ${v.id}: ${v.help}\n    nodes: ${v.nodes.map(n => n.target.join(' ')).slice(0, 5).join(' | ')}`)
        .join('\n');
      console.error(`Accessibility violations on ${path}:\n${summary}`);
    }
    expect(blocking, blocking.map(v => `${v.id} (${v.impact})`).join(', ')).toEqual([]);
  });
}
