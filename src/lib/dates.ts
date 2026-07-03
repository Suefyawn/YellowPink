// All human-facing dates must render in Pakistan time. The DB stores UTC
// timestamptz and on Vercel the server clock is UTC; a locale like 'en-PK'
// only picks number/month formatting, NOT a timezone, so without an explicit
// timeZone option server-rendered dates show 5 hours behind Pakistan (an
// order placed 02:30 PKT displays the previous day). Always pass PK_TZ.
export const PK_TZ = 'Asia/Karachi';

export const fmtDatePK = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: PK_TZ });

export const fmtDateTimePK = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ });

// Shared date display helper. blog_posts.date is stored as plain text
// ('YYYY-MM-DD'), the same format the admin form's native <input type="date">
// always submits. Historical/imported rows (mostly the original WordPress
// import) used a "Month D, YYYY" string instead, the two formats sort
// incorrectly against each other as plain text (a 2026-06-30 row reads as
// "less than" a "June 30, 2026" row character-by-character) and "Month D,
// YYYY" isn't valid ISO 8601 for the Article datePublished structured data.
// Storage has been normalised to ISO; this formats it back into the
// human-facing date readers see on cards, bylines and related-post rows.
export function formatBlogDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  // Date-only strings ('YYYY-MM-DD') parse as UTC midnight; +5h to PKT keeps
  // the same calendar day, so pinning the timezone is safe and deterministic.
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: PK_TZ });
}
