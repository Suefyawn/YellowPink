import { describe, it, expect } from 'vitest';
import { triageNotFound } from './not-found-triage';

const row = (path: string, resolved = false) => ({ path, resolved, hits: 1 });

describe('triageNotFound', () => {
  it('keeps an unresolved path with no redirect open', () => {
    const { open, handled } = triageNotFound([row('/product/gone')], new Map());
    expect(open.map(r => r.row.path)).toEqual(['/product/gone']);
    expect(handled).toEqual([]);
  });

  it('treats a path with a live redirect as handled even when the flag says open', () => {
    // The case that put /product/energy-boost back on the Open tab after it had
    // already been redirected by hand.
    const redirects = new Map([['/product/energy-boost', '/product/womens-energy-booster']]);
    const { open, handled } = triageNotFound([row('/product/energy-boost')], redirects);
    expect(open).toEqual([]);
    expect(handled).toHaveLength(1);
    expect(handled[0].redirectTo).toBe('/product/womens-energy-booster');
  });

  it('keeps an ignored path handled and reports no redirect for it', () => {
    const { open, handled } = triageNotFound([row('/old-campaign', true)], new Map());
    expect(open).toEqual([]);
    expect(handled[0].redirectTo).toBeNull();
  });

  it('preserves input order within each bucket', () => {
    const rows = [row('/a'), row('/b', true), row('/c'), row('/d')];
    const { open, handled } = triageNotFound(rows, new Map([['/c', '/shop']]));
    expect(open.map(r => r.row.path)).toEqual(['/a', '/d']);
    expect(handled.map(r => r.row.path)).toEqual(['/b', '/c']);
  });

  it('carries the original row through untouched', () => {
    const { open } = triageNotFound([row('/x')], new Map());
    expect(open[0].row).toEqual({ path: '/x', resolved: false, hits: 1 });
  });
});
