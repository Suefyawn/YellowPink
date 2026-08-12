import { describe, expect, it, vi, beforeEach } from 'vitest';

// The module under test reaches for supabase + isDemo at call time, and calls
// permanentRedirect (which throws NEXT_REDIRECT) on success. Both are mocked so
// the branch logic can be exercised without a database or a Next request scope.

const state = {
  isDemo: false,
  /** from_path -> to_path in the `redirects` table. */
  mapped: {} as Record<string, string>,
  /** table -> rows the storefront can see. */
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  /** Every table/filter combination the code actually asked for. */
  queries: [] as Array<{ table: string; filters: Array<[string, string, string]> }>,
  throwOnLookup: false,
};

vi.mock('./is-demo', () => ({ get isDemo() { return state.isDemo; } }));

vi.mock('./supabase', () => {
  const from = (table: string) => {
    const filters: Array<[string, string, string]> = [];
    const record = { table, filters };
    const builder = {
      select: () => builder,
      eq: (col: string, val: string) => { filters.push(['eq', col, val]); return builder; },
      lte: (col: string, val: string) => { filters.push(['lte', col, val]); return builder; },
      maybeSingle: async () => {
        if (state.throwOnLookup) throw new Error('connection reset');
        state.queries.push(record);
        if (table === 'redirects') {
          const from_path = filters.find(f => f[1] === 'from_path')?.[2] ?? '';
          const to = state.mapped[from_path];
          return { data: to ? { to_path: to } : null };
        }
        const hit = (state.rows[table] ?? []).find(row =>
          filters.every(([op, col, val]) =>
            op === 'eq' ? row[col] === val : String(row[col] ?? '') <= val),
        );
        return { data: hit ?? null };
      },
    };
    return builder;
  };
  // redirects.ts imports isDemo from './supabase' (which re-exports it), so the
  // getter has to live here, not only on the './is-demo' mock.
  return { supabase: { from }, get isDemo() { return state.isDemo; } };
});

const redirected: string[] = [];
vi.mock('next/navigation', () => ({
  permanentRedirect: (to: string) => { redirected.push(to); throw new Error('NEXT_REDIRECT'); },
}));

const { redirectIfMapped } = await import('./redirects');

/** Run the helper and report where it sent us, or null if it fell through. */
async function attempt(path: string): Promise<string | null> {
  redirected.length = 0;
  try { await redirectIfMapped(path); } catch (e) {
    if ((e as Error).message !== 'NEXT_REDIRECT') throw e;
  }
  return redirected[0] ?? null;
}

beforeEach(() => {
  state.isDemo = false;
  state.mapped = {};
  state.throwOnLookup = false;
  state.queries = [];
  state.rows = {
    products: [
      { slug: 'clean-shield-duo', status: 'published' },
      { slug: 'retired-serum',    status: 'draft' },
    ],
    collections: [{ slug: 'summer-glow', status: 'published' }],
    pages:       [{ slug: 'about-us',    status: 'published' }],
    blog_posts:  [
      { slug: 'winter-routine',  date: '2026-01-05' },
      { slug: 'scheduled-piece', date: '2099-01-01' },
    ],
  };
});

describe('manual redirects still win', () => {
  it('follows a hand-written mapping', async () => {
    state.mapped['/product/old-thing'] = '/product/new-thing';
    expect(await attempt('/product/old-thing')).toBe('/product/new-thing');
  });

  it('takes the manual mapping in preference to the structural guess', async () => {
    state.mapped['/product/clean-shield-duo-copy'] = '/collection/summer-glow';
    expect(await attempt('/product/clean-shield-duo-copy')).toBe('/collection/summer-glow');
  });

  it('never redirects a path to itself', async () => {
    state.mapped['/product/loop'] = '/product/loop';
    expect(await attempt('/product/loop')).toBeNull();
  });
});

describe('structural recovery', () => {
  it('strips a -copy suffix when the real product is live', async () => {
    expect(await attempt('/product/clean-shield-duo-copy')).toBe('/product/clean-shield-duo');
  });

  it('normalises case', async () => {
    expect(await attempt('/product/Clean-Shield-Duo')).toBe('/product/clean-shield-duo');
  });

  it('tolerates a trailing slash', async () => {
    expect(await attempt('/product/clean-shield-duo-copy/')).toBe('/product/clean-shield-duo');
  });

  it('works for collections and pages', async () => {
    expect(await attempt('/collection/summer-glow-copy')).toBe('/collection/summer-glow');
    expect(await attempt('/page/about-us-old')).toBe('/page/about-us');
  });

  // The gate is per-table: blog_posts has no status column, its scheduling
  // gate is a non-future `date`. Using .eq('status',…) there would error.
  it('uses the blog date gate, not a status column', async () => {
    expect(await attempt('/blog/winter-routine-copy')).toBe('/blog/winter-routine');
    const q = state.queries.find(x => x.table === 'blog_posts');
    expect(q!.filters.some(([op, col]) => op === 'lte' && col === 'date')).toBe(true);
    expect(q!.filters.some(([, col]) => col === 'status')).toBe(false);
  });

  it('will not send a visitor to an unpublished product', async () => {
    expect(await attempt('/product/retired-serum-copy')).toBeNull();
  });

  it('will not send a visitor to a scheduled post', async () => {
    expect(await attempt('/blog/scheduled-piece-copy')).toBeNull();
  });

  it('falls through when the cleaned slug does not exist either', async () => {
    expect(await attempt('/product/never-existed-copy')).toBeNull();
  });

  it('falls through when the slug is already canonical', async () => {
    expect(await attempt('/product/nope')).toBeNull();
  });
});

describe('what it deliberately will not do', () => {
  // Different products at different prices. Guessing between them sells the
  // wrong item silently, so these must reach the 404 page and its suggestions.
  it('does not guess between similar product slugs', async () => {
    state.rows.products.push({ slug: 'white-beauty-cream', status: 'published' });
    expect(await attempt('/product/beauty-cream')).toBeNull();
  });

  it('does not strip a bare trailing number', async () => {
    state.rows.products.push({ slug: 'sun-block-spf', status: 'published' });
    expect(await attempt('/product/sun-block-spf-30')).toBeNull();
  });

  // /brand, /tag, /category and /author slugs are derived from product text
  // rather than stored, so there is no row to confirm against.
  it('skips routes with no backing slug table', async () => {
    await attempt('/brand/cerave-copy');
    await attempt('/tag/gifting-copy');
    await attempt('/author/someone-copy');
    expect(state.queries.filter(q => q.table !== 'redirects')).toHaveLength(0);
  });

  it('ignores a multi-segment path whose trailing pair is not a known kind', async () => {
    expect(await attempt('/product/a/b-copy')).toBeNull();
  });
});

// The single most common real 404 from a human in this store's log was
// /product/anastasia-beverly-hills-highlighter-glow-seeker/product/f-lium-drops
// — a relative <a href="product/..."> resolving against the current PDP. The
// target was a live product the whole time.
describe('doubled paths from a relative link', () => {
  it('recovers the trailing /kind/slug pair', async () => {
    state.rows.products.push({ slug: 'f-lium-drops', status: 'published' });
    expect(await attempt('/product/anastasia-highlighter/product/f-lium-drops'))
      .toBe('/product/f-lium-drops');
  });

  it('still verifies the target is live', async () => {
    expect(await attempt('/product/anything/product/retired-serum')).toBeNull();
  });

  it('works for a doubled blog path too', async () => {
    expect(await attempt('/blog/some-post/blog/winter-routine')).toBe('/blog/winter-routine');
  });

  it('does not fire when the trailing pair already is the whole path', async () => {
    expect(await attempt('/product/clean-shield-duo')).toBeNull();
    // and costs no query, because the cleaned path is identical
    expect(state.queries.filter(q => q.table === 'products')).toHaveLength(0);
  });
});

describe('failure modes', () => {
  it('does nothing at all in demo mode', async () => {
    state.isDemo = true;
    state.mapped['/product/old-thing'] = '/product/new-thing';
    expect(await attempt('/product/old-thing')).toBeNull();
    expect(state.queries).toHaveLength(0);
  });

  it('lets the 404 through when the lookup throws', async () => {
    state.throwOnLookup = true;
    await expect(attempt('/product/clean-shield-duo-copy')).resolves.toBeNull();
  });
});
