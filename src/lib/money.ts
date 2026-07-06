// Single PKR money formatter for the admin finance surfaces. We don't track
// paisa, so round to whole rupees and group thousands. Tolerant of the
// string/null shapes Postgres numeric columns arrive in via supabase-js.
//
// The locale is pinned to 'en-US' so the grouping is identical on the server
// (Node, en-US default) and in the browser (whatever the visitor's locale is).
// A bare `.toLocaleString()` groups by the runtime locale, so a client set to
// e.g. en-IN (lakh grouping) or a non-Latin numeral locale rendered a
// different string than the SSR HTML → a React hydration mismatch on any
// client-component price. Pinning removes that whole class of bug.
export const fmtPKR = (n: number | string | null | undefined) =>
  `PKR ${Math.round(Number(n ?? 0) || 0).toLocaleString('en-US')}`;
