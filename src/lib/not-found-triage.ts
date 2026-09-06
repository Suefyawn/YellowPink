// Splitting the 404 log into "still broken" and "handled".
//
// The `resolved` flag on not_found_log is only set by the admin actions
// (addRedirect / ignoreNotFound). A redirect added any other way — a SQL fix, a
// migration, a bulk import — leaves the row open, so the Broken links page
// keeps showing a path that has 301'd for days and offers a Redirect form that
// would silently overwrite the good target (audit, 6 Sep 2026).
//
// So a path counts as handled if it was marked resolved OR an active redirect
// exists for it. The redirects table is the ground truth about whether a path
// still 404s; the flag is just bookkeeping.

export interface NotFoundRow {
  path: string;
  resolved: boolean;
}

export interface TriagedRow<T extends NotFoundRow> {
  row: T;
  /** Where this path now sends visitors, when a redirect covers it. */
  redirectTo: string | null;
}

/**
 * Partition logged 404s into the paths that still need a decision and the ones
 * already handled. `redirectByPath` maps from_path to to_path for every active
 * redirect; a row whose path is in it is handled whatever its flag says.
 */
export function triageNotFound<T extends NotFoundRow>(
  rows: T[],
  redirectByPath: Map<string, string>,
): { open: TriagedRow<T>[]; handled: TriagedRow<T>[] } {
  const open: TriagedRow<T>[] = [];
  const handled: TriagedRow<T>[] = [];
  for (const row of rows) {
    const redirectTo = redirectByPath.get(row.path) ?? null;
    (row.resolved || redirectTo ? handled : open).push({ row, redirectTo });
  }
  return { open, handled };
}
