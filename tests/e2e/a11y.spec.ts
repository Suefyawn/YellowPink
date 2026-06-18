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
    // Reduced motion makes the `.fade-in` entry animation instant (globals.css
    // zeroes animation-duration under it), so axe doesn't mis-measure contrast
    // against a mid-fade, semi-transparent page.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await page.waitForLoadState('load');
    // Bounded settle for hydration. networkidle is capped because the dev
    // server's persistent HMR connection never lets it fire in CI — without the
    // cap the test hangs to its timeout; with it we wait at most 3s then scan
    // the hydrated DOM.
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

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
