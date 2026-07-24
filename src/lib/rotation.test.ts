import { describe, it, expect } from 'vitest';
import { dailyRotation } from './rotation';

const pool = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}` }));

describe('dailyRotation', () => {
  it('is deterministic within a day', () => {
    const a = dailyRotation(pool, 4, 'rail');
    const b = dailyRotation(pool, 4, 'rail');
    expect(a).toEqual(b);
  });

  it('returns the requested count from a larger pool', () => {
    expect(dailyRotation(pool, 4)).toHaveLength(4);
  });

  it('returns the whole pool unshuffled when it fits', () => {
    const small = pool.slice(0, 3);
    expect(dailyRotation(small, 4)).toEqual(small);
  });

  it('different salts rotate differently', () => {
    const a = dailyRotation(pool, 6, 'one').map(p => p.id).join(',');
    const b = dailyRotation(pool, 6, 'two').map(p => p.id).join(',');
    expect(a).not.toEqual(b);
  });
});
