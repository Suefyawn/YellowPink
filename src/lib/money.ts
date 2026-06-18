// Single PKR money formatter for the admin finance surfaces. We don't track
// paisa, so round to whole rupees and group thousands. Tolerant of the
// string/null shapes Postgres numeric columns arrive in via supabase-js.
export const fmtPKR = (n: number | string | null | undefined) =>
  `PKR ${Math.round(Number(n ?? 0) || 0).toLocaleString()}`;
