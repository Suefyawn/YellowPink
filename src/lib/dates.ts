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
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
