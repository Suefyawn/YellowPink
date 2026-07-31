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
  'dgkhan': 'Dera Ghazi Khan',
  'dg khan': 'Dera Ghazi Khan',
  'd.g. khan': 'Dera Ghazi Khan',
};

// City → province, for the checkout's automatic province inference. Values
// are exactly the 7 province strings the checkout select emits (and
// province_zones maps): Punjab, Sindh, KPK, Balochistan, Islamabad, AJK,
// Gilgit-Baltistan. Covers every city in PK_CITIES; smaller towns fall
// through to null and the shopper can still pick a province by hand.
const CITY_PROVINCE: Record<string, string> = {
  // Sindh
  'Karachi': 'Sindh', 'Hyderabad': 'Sindh', 'Sukkur': 'Sindh',
  'Larkana': 'Sindh', 'Mirpur Khas': 'Sindh', 'Nawabshah': 'Sindh',
  // Punjab
  'Lahore': 'Punjab', 'Rawalpindi': 'Punjab', 'Faisalabad': 'Punjab',
  'Multan': 'Punjab', 'Gujranwala': 'Punjab', 'Sialkot': 'Punjab',
  'Bahawalpur': 'Punjab', 'Sargodha': 'Punjab', 'Sheikhupura': 'Punjab',
  'Gujrat': 'Punjab', 'Kasur': 'Punjab', 'Rahim Yar Khan': 'Punjab',
  'Sahiwal': 'Punjab', 'Okara': 'Punjab', 'Wah Cantonment': 'Punjab',
  'Dera Ghazi Khan': 'Punjab', 'Chiniot': 'Punjab', 'Kamoke': 'Punjab',
  'Jhang': 'Punjab', 'Jhelum': 'Punjab', 'Khanewal': 'Punjab',
  'Hafizabad': 'Punjab', 'Taxila': 'Punjab', 'Chakwal': 'Punjab',
  'Daska': 'Punjab', 'Mandi Bahauddin': 'Punjab', 'Sukheke': 'Punjab',
  'Burewala': 'Punjab', 'Samundri': 'Punjab', 'Shahpur': 'Punjab',
  'Sadiqabad': 'Punjab',
  // Capital territory
  'Islamabad': 'Islamabad',
  // KPK
  'Peshawar': 'KPK', 'Mardan': 'KPK', 'Abbottabad': 'KPK', 'Kohat': 'KPK',
  'Mingora (Swat)': 'KPK',
  // Balochistan
  'Quetta': 'Balochistan', 'Gwadar': 'Balochistan',
  // AJK / GB
  'Muzaffarabad': 'AJK', 'Mirpur (AJK)': 'AJK',
  'Gilgit': 'Gilgit-Baltistan',
};

/** Province for a (normalised) city, or null when the city isn't recognised.
 *  Checkout uses this to auto-fill the hidden province from the required city
 *  field, so shipping-zone pricing works without asking the shopper an extra
 *  question (the July 25 four-field form left province empty on every order,
 *  and every remote-zone delivery quoted the cheapest zone's rate). */
export function provinceForCity(city: string): string | null {
  return CITY_PROVINCE[normalizeCity(city)] ?? null;
}

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
