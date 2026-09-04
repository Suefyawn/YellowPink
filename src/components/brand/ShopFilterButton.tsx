'use client';

// "Filter & sort all <brand> products" on the brand archive. It used to be a
// <Link> to /shop?brand=<name>. That URL is the filter UI, not a destination:
// it shows the same products as the brand page and canonicalizes back to it,
// yet a crawlable link from every archive published 56 near-duplicate URLs
// that each had exactly one inbound link (Semrush #213) and spent crawl
// budget on nothing. A button that navigates keeps the affordance for the
// shopper and publishes no URL. The sort/filter controls on /shop are
// themselves buttons, so this is consistent with how the filter is reached
// elsewhere.

import { useRouter } from 'next/navigation';

export function ShopFilterButton({ brand }: { brand: string }) {
  const router = useRouter();
  return (
    // .text-link already resets button chrome (no background/border) and
    // draws the arrow, so this renders exactly as the old link did.
    <button
      type="button"
      className="text-link"
      onClick={() => router.push(`/shop?brand=${encodeURIComponent(brand)}`)}
    >
      Filter &amp; sort all {brand} products
    </button>
  );
}
