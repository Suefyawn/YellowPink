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

/** Their combo/pack listings — never a valid comparison target for a single. */
function isTheirBundle(t: TheirProduct): boolean {
  const l = ` ${t.title.toLowerCase()} `;
  return t.title.includes('+') || / and /.test(l) || l.includes('double pack') || l.includes('gift');
}

export function matchCatalog(ours: OurProduct[], theirs: TheirProduct[]): ParityResult {
  const byHandle = new Map(theirs.map(t => [t.handle, t]));
  const singles = theirs.filter(t => !isTheirBundle(t) && t.price > 0);

  const unmatched: string[] = [];
  const violations: ParityViolation[] = [];
  let compared = 0;

  for (const o of ours) {
    const aliased = HANDLE_ALIASES[o.slug];
    let t = (aliased && byHandle.get(aliased)) || byHandle.get(o.slug) || null;
    if (t && (isTheirBundle(t) || t.price <= 0)) t = null;
    if (!t) {
      // First word of our product name ("Trimo-M Ashwagandha …" → "trimom")
      // against the start of their title or handle, singles only.
      const key = norm(o.name.split(/\s+/)[0]);
      if (key.length >= 4) {
        t = singles.find(s => norm(s.title).startsWith(key) || norm(s.handle).startsWith(key)) ?? null;
      }
    }
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
      const json = (await res.json()) as { products?: Array<{ title?: string; handle?: string; variants?: Array<{ price?: string }> }> };
      const batch = json.products ?? [];
      for (const p of batch) {
        if (!p.title || !p.handle) continue;
        out.push({ title: p.title, handle: p.handle, price: Number(p.variants?.[0]?.price ?? 0) });
      }
      if (batch.length < 250) break;
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
}
