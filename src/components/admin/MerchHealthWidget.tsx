import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';

// Merchandising health card: the pin-guardrail that makes checkboxes safe
// for a busy owner. Two tiers, deliberately (adversarial review): BROKEN is
// rare and always actionable; ADVISORY is informational and expected to be
// non-empty sometimes. A wall of permanent red trains the owner to ignore
// the card, which buries the one alarm that matters (dead score cron).

interface Issue { text: string; href?: string }

const DAY_MS = 86_400_000;

// All queries + clock-dependent classification live here, outside the
// component body, so the render itself stays pure (repo convention: data
// carries its own dates; components never read the clock).
async function loadHealthIssues(): Promise<{ broken: Issue[]; advisory: Issue[] }> {
  const admin = supabaseAdmin();
  const [pinsRes, saleCountRes, saleSettingRes, nullHeroRes, featuredPostRes, cronRes, staleCompareRes] = await Promise.all([
    admin.from('products').select('id, name, stock, track_inventory, is_featured, is_bestseller, popularity_score')
      .eq('status', 'published').or('is_featured.eq.true,is_bestseller.eq.true'),
    admin.from('products').select('id', { count: 'exact', head: true })
      .eq('status', 'published').gte('discount_pct', 10).or('stock.gt.0,track_inventory.is.false,continue_selling_when_out.is.true'),
    admin.from('site_settings').select('value').eq('key', 'sale_active').maybeSingle(),
    admin.from('blog_posts').select('slug, title').is('image_url', null),
    admin.from('blog_posts').select('slug, title, date').eq('featured', true).maybeSingle(),
    admin.from('analytics_cache').select('data, updated_at').eq('key', 'popularity_refresh_last_run').maybeSingle(),
    admin.from('products').select('id', { count: 'exact', head: true })
      .not('original_price', 'is', null).filter('discount_pct', 'lte', 0),
  ]);

  const pins = (pinsRes.data ?? []) as { id: string; name: string; stock: number | null; track_inventory: boolean | null; is_featured: boolean | null; is_bestseller: boolean | null; popularity_score: number | null }[];
  const soldOutPins = pins.filter(p => p.track_inventory !== false && (p.stock ?? 0) <= 0);
  const bestsellerPins = pins.filter(p => p.is_bestseller);
  const zeroDemandPins = pins.filter(p => !soldOutPins.includes(p) && Number(p.popularity_score ?? 0) === 0);

  const saleOn = ((saleSettingRes.data as { value?: string } | null)?.value ?? '').toLowerCase() === 'true';
  const qualifyingSaleProducts = saleCountRes.count ?? 0;

  const featuredPost = featuredPostRes.data as { slug: string; title: string; date: string } | null;
  const heroFloorISO = new Date(Date.now() - 60 * DAY_MS).toISOString().slice(0, 10);
  const nullHeroPosts = (nullHeroRes.data ?? []) as { slug: string; title: string }[];

  const cronAt = (cronRes.data as { data?: { at?: string } } | null)?.data?.at ?? null;
  const cronAgeH = cronAt ? (Date.now() - new Date(cronAt).getTime()) / 3_600_000 : null;

  const broken: Issue[] = [];
  const advisory: Issue[] = [];

  if (cronAgeH == null) broken.push({ text: 'Popularity score refresh has never recorded a run — rails may be riding stale or empty scores. It runs in the daily cron; check the cron logs.' });
  else if (cronAgeH > 48) broken.push({ text: `Popularity score refresh last ran ${Math.round(cronAgeH)}h ago (over 48h) — homepage rails are riding stale scores.` });

  for (const p of soldOutPins) {
    broken.push({ text: `"${p.name}" is sold out but still pinned ${p.is_featured ? 'Featured' : ''}${p.is_featured && p.is_bestseller ? ' + ' : ''}${p.is_bestseller ? 'Best Seller' : ''} — it is excluded from the rails until restocked; unpin or restock.`, href: `/admin/products?edit=${p.id}` });
  }

  if (saleOn && qualifyingSaleProducts === 0) {
    broken.push({ text: 'The "On Sale Now" section is switched ON but no in-stock product has a 10%+ discount — the section shows nothing. Add discounts or switch it off.', href: '/admin/settings' });
  }

  for (const b of nullHeroPosts) {
    broken.push({ text: `Blog post "${b.title}" has no hero image — its tile falls back to a plain monogram and it has no social share image.`, href: `/admin/blog` });
  }

  if (!featuredPost) {
    advisory.push({ text: 'No blog post is featured — the blog hero falls back to the newest post. Feature one from Admin → Blog when a post deserves the spotlight.', href: '/admin/blog' });
  } else if (featuredPost.date < heroFloorISO) {
    advisory.push({ text: `The featured post "${featuredPost.title}" is over 60 days old, so the hero has fallen back to the newest post. Re-feature it to force it, or feature something fresher.`, href: '/admin/blog' });
  }

  if (bestsellerPins.length > 2) {
    advisory.push({ text: `${bestsellerPins.length} products are pinned as Best Sellers but only 2 pin slots exist — the rest compete on real sales like everything else.` });
  }

  if (zeroDemandPins.length > 0) {
    advisory.push({ text: `${zeroDemandPins.length} pinned product${zeroDemandPins.length > 1 ? 's have' : ' has'} had no shopper activity at all recently (no views, carts or sales) — worth reviewing whether the pin still earns its slot.` });
  }

  if ((staleCompareRes.count ?? 0) > 0) {
    advisory.push({ text: `${staleCompareRes.count} product${(staleCompareRes.count ?? 0) > 1 ? 's carry' : ' carries'} a compare-at price that is not above the selling price — harmless (they can't enter the Sale rail), but worth a tidy-up.` });
  }

  return { broken, advisory };
}

export async function MerchHealthWidget() {
  const { broken, advisory } = await loadHealthIssues();

  const dot = (color: string) => (
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, marginTop: 6 }} />
  );

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Merchandising health</h2>
        <Link href="/admin/homepage-preview" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>Today&apos;s homepage →</Link>
      </div>
      {broken.length === 0 && advisory.length === 0 ? (
        <div style={{ padding: '20px 24px', color: '#15803d', fontSize: '0.875rem', fontWeight: 600 }}>
          All clear — every rail has fresh scores, no pin is sold out, and the blog hero is current.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: '12px 24px 16px' }}>
          {broken.map((i, k) => (
            <li key={`b${k}`} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: '0.8125rem', color: '#111827' }}>
              {dot('#dc2626')}
              <span>{i.text}{i.href && <> <Link href={i.href} style={{ color: '#C5286A' }}>Fix →</Link></>}</span>
            </li>
          ))}
          {advisory.map((i, k) => (
            <li key={`a${k}`} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              {dot('#d1d5db')}
              <span>{i.text}{i.href && <> <Link href={i.href} style={{ color: '#C5286A' }}>Open →</Link></>}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
