import { describe, it, expect } from 'vitest';
import { buildRobotsTxt } from './route';

describe('robots.txt', () => {
  const txt = buildRobotsTxt(true);

  it('keeps the crawler-cost blocks and the private paths', () => {
    expect(txt).toMatch(/User-Agent: Bytespider\nDisallow: \/\n/);
    expect(txt).toMatch(/User-Agent: \*\nAllow: \/\nDisallow: \/admin\//);
    expect(txt).toContain('Disallow: /go/');
  });

  it('names the AI crawlers as allowed, with the same private paths', () => {
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
      expect(txt).toMatch(new RegExp(`User-Agent: ${bot}\\nAllow: /\\nDisallow: /admin/`));
    }
  });

  it('declares the content signal and the sitemap', () => {
    expect(txt).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=yes');
    expect(txt).toMatch(/Sitemap: https:\/\/[^\n]+\/sitemap\.xml/);
  });

  it('noindexes everything off production', () => {
    expect(buildRobotsTxt(false)).toBe('User-Agent: *\nDisallow: /\n');
  });
});
