import { revalidatePath } from 'next/cache';

/**
 * Revalidate the storefront ISR pages that surface catalogue data — products,
 * brands and collections. Admin create/update/delete/publish mutations call
 * this so an edit shows on the live site immediately instead of waiting out
 * the pages' 5-minute ISR window (`export const revalidate = 300`).
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
  revalidatePath('/product/[slug]', 'page');
  revalidatePath('/brand/[slug]', 'page');
  revalidatePath('/collection/[slug]', 'page');
}
