import { describe, expect, it, vi, beforeEach } from 'vitest';

// reconcileStock turns "set stock to N" into the signed delta the ledger RPC
// wants. These pin the two things that make it safe: it is a no-op when the
// figure has not moved (so saving a product form does not litter Movement
// history), and it never throws (a failed ledger write must not roll back an
// otherwise-good save).

const state = {
  productStock: new Map<string, number>(),
  variantStock: new Map<string, number>(),
  rpcCalls: [] as Array<Record<string, unknown>>,
  rpcError: null as { message: string } | null,
};

vi.mock('./supabase', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => {
            const m = table === 'products' ? state.productStock : state.variantStock;
            return { data: m.has(id) ? { stock: m.get(id) } : null };
          },
        }),
      }),
    }),
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push(args);
      return { data: null, error: state.rpcError };
    },
  }),
}));

vi.mock('./logger', () => ({ log: { error: () => {}, warn: () => {}, info: () => {} } }));

const { reconcileStock, splitStock } = await import('./stock-writes');

const actor = { isOwner: true, email: 'owner@example.com' };

beforeEach(() => {
  state.productStock = new Map([['p1', 10]]);
  state.variantStock = new Map([['v1', 4]]);
  state.rpcCalls = [];
  state.rpcError = null;
});

describe('reconcileStock', () => {
  it('books the difference, not the absolute figure', async () => {
    const r = await reconcileStock({ productId: 'p1', nextStock: 14, actor, note: 'n' });
    expect(r).toEqual({ delta: 4 });
    expect(state.rpcCalls[0]).toMatchObject({ p_product_id: 'p1', p_qty_delta: 4, p_reason: 'adjustment' });
  });

  it('books a negative delta when the count goes down', async () => {
    await reconcileStock({ productId: 'p1', nextStock: 3, actor, note: 'n' });
    expect(state.rpcCalls[0]).toMatchObject({ p_qty_delta: -7 });
  });

  it('writes nothing when the figure is unchanged', async () => {
    expect(await reconcileStock({ productId: 'p1', nextStock: 10, actor, note: 'n' })).toBeNull();
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('reconciles a variant against the variant row, not the parent', async () => {
    await reconcileStock({ productId: 'p1', variantId: 'v1', nextStock: 6, actor, note: 'n' });
    // v1 holds 4, p1 holds 10 — a delta of 2 proves it read the variant.
    expect(state.rpcCalls[0]).toMatchObject({ p_variant_id: 'v1', p_qty_delta: 2 });
  });

  it('records who made the change', async () => {
    await reconcileStock({ productId: 'p1', nextStock: 11, actor: { isOwner: false, email: 'staff@x.com' }, note: 'why' });
    expect(state.rpcCalls[0]).toMatchObject({ p_actor_kind: 'staff', p_actor_email: 'staff@x.com', p_note: 'why' });
  });

  it('ignores a nonsense figure instead of booking it', async () => {
    for (const bad of [-1, 1.5, NaN]) {
      expect(await reconcileStock({ productId: 'p1', nextStock: bad, actor, note: 'n' })).toBeNull();
    }
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('does nothing for a product that no longer exists', async () => {
    expect(await reconcileStock({ productId: 'gone', nextStock: 5, actor, note: 'n' })).toBeNull();
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('swallows a ledger failure rather than breaking the save around it', async () => {
    state.rpcError = { message: 'db down' };
    await expect(reconcileStock({ productId: 'p1', nextStock: 99, actor, note: 'n' })).resolves.toBeNull();
  });
});

describe('splitStock', () => {
  it('lifts stock out so the rest of the row can be written normally', () => {
    const { rest, stock } = splitStock({ name: 'X', price: 100, stock: 7 });
    expect(stock).toBe(7);
    expect('stock' in rest).toBe(false);
    expect(rest).toEqual({ name: 'X', price: 100 });
  });

  it('reports null when the payload carries no stock, so nothing is reconciled', () => {
    expect(splitStock({ name: 'X' }).stock).toBeNull();
  });

  it('keeps an explicit zero — that is a real sell-out', () => {
    expect(splitStock({ stock: 0 }).stock).toBe(0);
  });

  it('rejects a negative or fractional figure', () => {
    expect(splitStock({ stock: -3 }).stock).toBeNull();
    expect(splitStock({ stock: 2.5 }).stock).toBeNull();
  });
});
