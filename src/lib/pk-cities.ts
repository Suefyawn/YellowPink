// Canonical Pakistani city list + normalizer for the checkout city field.
//
// The field was free-text, so the orders table accumulated dirty values —
// "Karchi", "Karachi", "KARACHI", "lahore", "  Mirpur Azad Kashmir", "Abc".
// That breaks shipping-zone matching and any city-level analytics. We keep the
// field free (smaller towns must still be enterable) but:
//   • offer a <datalist> of the major cities so shoppers pick the canonical
//     spelling instead of typing a variant, and
//   • normalise on blur/submit (trim, collapse spaces, Title Case, fix a few
//     common misspellings) so casing/whitespace noise never reaches the DB.

// Major cities + the ones already seen in orders. Ordered roughly by size; the
// datalist shows them as suggestions but any value is still accepted.
export const PK_CITIES: readonly string[] = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan',
  'Gujranwala', 'Peshawar', 'Quetta', 'Sialkot', 'Hyderabad', 'Bahawalpur',
  'Sargodha', 'Sukkur', 'Larkana', 'Sheikhupura', 'Gujrat', 'Mardan', 'Kasur',
  'Rahim Yar Khan', 'Sahiwal', 'Okara', 'Wah Cantonment', 'Dera Ghazi Khan',
  'Mirpur Khas', 'Nawabshah', 'Chiniot', 'Kamoke', 'Jhang', 'Abbottabad',
  'Muzaffarabad', 'Mirpur (AJK)', 'Gilgit', 'Jhelum', 'Khanewal', 'Hafizabad',
  'Kohat', 'Gwadar', 'Taxila', 'Chakwal', 'Daska', 'Mandi Bahauddin',
  'Sukheke', 'Burewala', 'Samundri', 'Shahpur', 'Sadiqabad', 'Mingora (Swat)',
];

// A few high-frequency misspellings/short-forms seen in real orders. Keyed by
// lower-cased, whitespace-collapsed input.
const ALIASES: Record<string, string> = {
  'karchi': 'Karachi',
  'karac hi': 'Karachi',
  'pindi': 'Rawalpindi',
  'isb': 'Islamabad',
  'mirpur azad kashmir': 'Mirpur (AJK)',
  'azad kashmir': 'Mirpur (AJK)',
  'rwp': 'Rawalpindi',
};

/** Normalise a free-text city: trim, collapse internal whitespace, map known
 *  aliases, else Title Case. Returns '' for empty/garbage-whitespace input. */
export function normalizeCity(raw: string): string {
  const collapsed = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!collapsed) return '';
  const alias = ALIASES[collapsed.toLowerCase()];
  if (alias) return alias;
  return collapsed
    .toLowerCase()
    .split(' ')
    .map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
