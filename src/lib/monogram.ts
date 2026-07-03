// Shared "monogram tile" treatment for image-less entries: a stable
// label-hashed pastel gradient with the entry's initials in the display
// serif. Used by ProductImage's placeholder (product tiles, blog cards)
// and the /brands directory fallback so every image-less tile across the
// storefront looks intentional and identical, not like a blank hole.

/** Stable hash → soft pastel gradient. Two entries with the same label always
 *  get the same gradient (so the catalog feels intentional, not random noise). */
export function monogramGradient(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  const h1 = Math.abs(h) % 360;
  const h2 = (h1 + 40) % 360;
  return `radial-gradient(at 25% 25%, hsl(${h1}, 70%, 90%), transparent 60%), radial-gradient(at 75% 75%, hsl(${h2}, 70%, 88%), transparent 60%), linear-gradient(135deg, hsl(${h1}, 50%, 95%), hsl(${h2}, 50%, 92%))`;
}

/** Two-letter monogram for the gradient tile ("Beauty of Joseon" → "BO"). */
export function monogramInitials(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '◇';
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
