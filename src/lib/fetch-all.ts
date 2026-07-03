// ============================================================================
// Paginated Supabase reads.
//
// PostgREST silently caps every response at 1000 rows (`max-rows`), so a bare
// `await query` on a table that has grown past that returns a truncated set
// with NO error — the newsletter list stops at subscriber #1000, the finance
// export quietly drops orders, etc.
//
// `fetchAll` walks the query with `.range()` until a short page signals
// exhaustion, and returns the same `{ data, error }` shape a plain awaited
// Supabase query gives you, so call sites keep their existing error handling.
//
// Notes for callers:
//   • Apply a stable `.order(...)` to the query — paging an unordered set can
//     skip/duplicate rows if writes land mid-walk.
//   • Re-invoking `.range()` on the same builder just overwrites the previous
//     offset/limit and each `await` re-executes the request, so passing the
//     builder once is enough.
// ============================================================================

/** PostgREST's default response cap; also our page size. */
export const FETCH_ALL_PAGE_SIZE = 1000;

/** Hard safety cap so a runaway table can't hold a request hostage. */
export const FETCH_ALL_HARD_CAP = 50_000;

export interface PageError {
  message: string;
}

/** Structural slice of a Supabase query builder: `.range()` returns a
 *  thenable that resolves to `{ data, error }`. */
export interface PagedQuery<Row> {
  range(from: number, to: number): PromiseLike<{ data: Row[] | null; error: PageError | null }>;
}

export interface FetchAllOptions {
  /** Rows per page. Defaults to {@link FETCH_ALL_PAGE_SIZE}. */
  pageSize?: number;
  /** Max total rows before we stop paging. Defaults to {@link FETCH_ALL_HARD_CAP}. */
  cap?: number;
}

/**
 * Page through `query` via `.range()` until exhausted (or the safety cap).
 *
 * Mirrors the awaited-query result shape: `{ data: rows, error: null }` on
 * success, `{ data: null, error }` on the first failed page.
 */
export async function fetchAll<Row>(
  query: PagedQuery<Row>,
  opts: FetchAllOptions = {},
): Promise<{ data: Row[] | null; error: PageError | null }> {
  const pageSize = Math.max(1, Math.floor(opts.pageSize ?? FETCH_ALL_PAGE_SIZE));
  const cap = Math.max(pageSize, Math.floor(opts.cap ?? FETCH_ALL_HARD_CAP));

  const rows: Row[] = [];
  for (let from = 0; from < cap; from += pageSize) {
    // Inclusive range; clamp the last page to the cap.
    const to = Math.min(from + pageSize, cap) - 1;
    const { data, error } = await query.range(from, to);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    // A short (or empty) page means the table is exhausted.
    if (page.length < to - from + 1) break;
  }
  return { data: rows, error: null };
}
