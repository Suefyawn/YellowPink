import { describe, expect, it, vi } from 'vitest';
import { fetchAll, FETCH_ALL_PAGE_SIZE, type PagedQuery, type PageError } from './fetch-all';

/** Fake Supabase query over an in-memory dataset, recording every range call. */
function makeQuery<Row>(rows: Row[], failOnCall?: number): PagedQuery<Row> & { calls: Array<[number, number]> } {
  const calls: Array<[number, number]> = [];
  return {
    calls,
    range(from: number, to: number) {
      calls.push([from, to]);
      if (failOnCall !== undefined && calls.length === failOnCall) {
        return Promise.resolve({ data: null, error: { message: 'boom' } as PageError });
      }
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
}

const dataset = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));

describe('fetchAll', () => {
  it('returns everything from a single short page in one call', async () => {
    const q = makeQuery(dataset(3));
    const { data, error } = await fetchAll(q);
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(q.calls).toEqual([[0, FETCH_ALL_PAGE_SIZE - 1]]);
  });

  it('pages past the 1000-row PostgREST cap until a short page', async () => {
    const q = makeQuery(dataset(2500));
    const { data, error } = await fetchAll(q);
    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(data![0]).toEqual({ id: 0 });
    expect(data![2499]).toEqual({ id: 2499 });
    expect(q.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('stops after an empty page when the total is an exact page multiple', async () => {
    const q = makeQuery(dataset(2000));
    const { data } = await fetchAll(q);
    expect(data).toHaveLength(2000);
    // Third call returns 0 rows, which terminates the walk.
    expect(q.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('respects a custom page size', async () => {
    const q = makeQuery(dataset(25));
    const { data } = await fetchAll(q, { pageSize: 10 });
    expect(data).toHaveLength(25);
    expect(q.calls).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it('enforces the hard cap and clamps the final page to it', async () => {
    const q = makeQuery(dataset(100));
    const { data } = await fetchAll(q, { pageSize: 30, cap: 70 });
    expect(data).toHaveLength(70);
    expect(q.calls).toEqual([[0, 29], [30, 59], [60, 69]]);
  });

  it('propagates the first page error and returns null data', async () => {
    const q = makeQuery(dataset(5000), 2);
    const { data, error } = await fetchAll(q);
    expect(data).toBeNull();
    expect(error).toEqual({ message: 'boom' });
    expect(q.calls).toHaveLength(2); // stopped at the failing page
  });

  it('treats null page data as an empty page', async () => {
    const range = vi.fn().mockResolvedValue({ data: null, error: null });
    const { data, error } = await fetchAll<{ id: number }>({ range });
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(range).toHaveBeenCalledTimes(1);
  });
});
