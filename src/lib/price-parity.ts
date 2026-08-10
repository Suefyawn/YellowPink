// ============================================================================
// NB Sons price-parity check.
//
// The arrangement with NB Sons: we never sell their individual products
// below their own store price — discounts live only in bundles. This module
// pulls their public Shopify catalog (nbsons.com/products.json) and compares
// it against our published singles for that vendor, so drift in either
// catalog surfaces as an alert instead of a vendor-relations problem.
//
// Matching is deliberately conservative: exact slug↔handle first, then a
// hand-kept alias map, then a first-token match that skips their combo
// listings ("X-Fit + Trimo-M", "Calco Fit and Vit KD") — a single must never
// be compared against a bundle's price. Unmatched products are reported as a
// count, never guessed at.
// ============================================================================

export interface TheirProduct {
  title: string;
  handle: string;
  price: number;
}

export interface OurProduct {
  slug: string;
  name: string;
  price: number;
}

export interface ParityViolation {
  slug: string;
  name: string;
  ourPrice: number;
  theirPrice: number;
  theirHandle: string;
}

export interface ParityResult {
  compared: number;
  unmatched: string[];
  violations: ParityViolation[];
}

/** Our slug → their handle, for names that don't line up mechanically. */
const HANDLE_ALIASES: Record<string, string> = {
  'argivital-sachet': 'argivital',
  'repro-m': 'repro-m-male-fertility-supplement-pakistan',
  'vitamin-c-serum': 'c-serum',
  'pelagonium-ivy-leaf': 'palagonium',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Pack-size / strength tokens ("60ml", "120 ml", "20mg", "1kg") keyed by
 *  unit, normalized to base units. Two listings only describe the same
 *  sellable item when every unit they BOTH state agrees — our 60ml bottle
 *  must never be parity-checked against their 120ml one (the SimZee false
 *  alarm, Aug 2026). A unit only one side states is inconclusive, not a
 *  mismatch: their titles often add strength where ours only gives volume. */
function sizeTokens(s: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(ml|l|mg|g|kg)\b/gi)) {
    let value = Number(m[1]);
    let unit = m[2].toLowerCase();
    if (unit === 'l') { value *= 1000; unit = 'ml'; }
    if (unit === 'kg') { value *= 1000; unit = 'g'; }
    if (!out.has(unit)) out.set(unit, value); // first mention wins
  }
  return out;
}

function sizesConflict(a: string, b: string): boolean {
  const sa = sizeTokens(a), sb = sizeTokens(b);
  for (const [unit, va] of sa) {
    const vb = sb.get(unit);
    if (vb !== undefined && vb !== va) return true;
  }
  return false;
}

/** Form/flavour qualifiers that split one product into distinct sellable
 *  listings (Syrup vs Tablet, Orange vs Lemon). Singular/plural collapsed. */
const FORM_WORDS = new Set(['syrup', 'drop', 'tablet', 'capsule', 'sachet', 'powder', 'cream', 'orange', 'lemon', 'mango', 'strawberry']);

function formTokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.toLowerCase().split(/[^a-z]+/)) {
    const singular = w.endsWith('s') ? w.slice(0, -1) : w;
    if (FORM_WORDS.has(singular)) out.add(singular);
  }
  return out;
}

/** Remove form/flavour words from a base product name so a variant row's
 *  qualifiers come only from its own label ("Simrid Syrup & Drops" + "Drops"
 *  must read as a Drops listing, not a Syrup-and-Drops one). Sizes stay. */
export function stripFormWords(s: string): string {
  return s
    .split(/\s+/)
    .filter(w => {
      const bare = w.toLowerCase().replace(/[^a-z]/g, '');
      const singular = bare.endsWith('s') ? bare.slice(0, -1) : bare;
      return !FORM_WORDS.has(singular);
    })
    .join(' ')
    .replace(/\s*[&+/]\s*(?=[&+/]|$)/g, '')
    .trim();
}

/** Two listings describe the same sellable item only when their stated sizes
 *  agree AND, when both state a form/flavour, they share one. A qualifier
 *  stated by only one side is inconclusive, not a conflict. */
function qualifierConflict(a: string, b: string): boolean {
  if (sizesConflict(a, b)) return true;
  const fa = formTokens(a), fb = formTokens(b);
  if (fa.size === 0 || fb.size === 0) return false;
  for (const t of fa) if (fb.has(t)) return false;
  return true;
}

/** Their combo/pack listings — never a valid comparison target for a single. */
function isTheirBundle(t: TheirProduct): boolean {
  const l = ` ${t.title.toLowerCase()} `;
  return t.title.includes('+') || / and /.test(l) || l.includes('double pack') || l.includes('gift');
}

export function matchCatalog(ours: OurProduct[], theirs: TheirProduct[]): ParityResult {
  // First entry wins per handle: a multi-variant listing contributes several
  // rows with one handle, and the fallback scan below covers the rest.
  const byHandle = new Map<string, TheirProduct>();
  for (const t of theirs) if (!byHandle.has(t.handle)) byHandle.set(t.handle, t);
  const singles = theirs.filter(t => !isTheirBundle(t) && t.price > 0);

  const unmatched: string[] = [];
  const violations: ParityViolation[] = [];
  let compared = 0;

  for (const o of ours) {
    // Variant rows carry "slug#Label" — aliases and handles key on the base.
    const baseSlug = o.slug.split('#')[0];
    const aliased = HANDLE_ALIASES[baseSlug];
    const direct = (aliased && byHandle.get(aliased)) || byHandle.get(baseSlug) || null;

    // Candidates in preference order: the direct handle match, then every
    // single whose title/handle starts with our name's first word. The match
    // is the first candidate whose size AND form/flavour don't conflict —
    // our Drops variant must skip their Syrup row and land on their Drops.
    const candidates: TheirProduct[] = [];
    if (direct && !isTheirBundle(direct) && direct.price > 0) candidates.push(direct);
    const key = norm(o.name.split(/\s+/)[0]);
    if (key.length >= 4) {
      candidates.push(...singles.filter(s => norm(s.title).startsWith(key) || norm(s.handle).startsWith(key)));
    }
    const t = candidates.find(c => !qualifierConflict(o.name, c.title)) ?? null;
    if (!t) { unmatched.push(o.slug); continue; }
    compared++;
    if (o.price < t.price) {
      violations.push({ slug: o.slug, name: o.name, ourPrice: o.price, theirPrice: t.price, theirHandle: t.handle });
    }
  }

  return { compared, unmatched, violations };
}

/** Their public catalog. Shopify serves 250/page; they list well under that.
 *  NBSONS_STORE_URL overrides the base for tests and if their domain moves. */
export async function fetchNbSonsCatalog(): Promise<TheirProduct[]> {
  const base = process.env.NBSONS_STORE_URL || 'https://nbsons.com';
  const out: TheirProduct[] = [];
  for (let page = 1; page <= 3; page++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${base}/products.json?limit=250&page=${page}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'user-agent': 'YellowPink price-parity check (yellowpink.pk)' },
      });
      if (!res.ok) throw new Error(`nbsons.com responded ${res.status}`);
      const json = (await res.json()) as { products?: Array<{ title?: string; handle?: string; variants?: Array<{ title?: string; price?: string }> }> };
      const batch = json.products ?? [];
      for (const p of batch) {
        if (!p.title || !p.handle) continue;
        const variants = (p.variants ?? []).filter(v => v.price != null);
        if (variants.length <= 1) {
          out.push({ title: p.title, handle: p.handle, price: Number(variants[0]?.price ?? 0) });
        } else {
          // One row per size/form/flavour variant, the variant label carrying
          // the qualifier ("Ferosim … Syrup" / "… Tablet") so each of our
          // variants compares against its true counterpart, not variants[0].
          for (const v of variants) {
            const label = v.title && v.title !== 'Default Title' ? v.title : '';
            out.push({ title: `${label ? stripFormWords(p.title) : p.title} ${label}`.trim(), handle: p.handle, price: Number(v.price ?? 0) });
          }
        }
      }
      if (batch.length < 250) break;
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
}
