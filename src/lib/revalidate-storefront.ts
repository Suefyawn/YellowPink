import { revalidatePath } from 'next/cache';

/**
 * Revalidate the storefront ISR pages that surface catalogue data — products,
 * brands, collections, category pages, deals, and journal posts (whose buy
 * modules embed live product price/stock). Admin create/update/delete/publish
 * mutations call this so an edit shows on the live site immediately.
 *
 * Because every catalogue write funnels through here, the routes' periodic
 * ISR window can be long (an hour) — it exists only as a safety net. Short
 * windows defeat the build-time prerender on a low-traffic site: entries
 * expire between visits and every organic/crawler hit pays a cold render.
 *
 * The dynamic detail routes are revalidated by their route pattern (the `page`
 * form) because a single catalogue change can touch many of them at once — a
 * product appears on its PDP, on every brand/collection page that lists it,
 * and on smart collections whose rules it now matches — and we can't cheaply
 * enumerate which. The listing/home routes are literal paths.
 */
export function revalidateStorefrontCatalog(): void {
  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath('/collections');
  revalidatePath('/brands');
  revalidatePath('/deals');
  revalidatePath('/k-beauty');
  revalidatePath('/product/[slug]', 'page');
  revalidatePath('/brand/[slug]', 'page');
  revalidatePath('/collection/[slug]', 'page');
  revalidatePath('/category/[slug]', 'page');
  revalidatePath('/blog/[slug]', 'page');
}
