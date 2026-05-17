// WooCommerce product reviews → public.product_reviews.
// (WC stores reviews as WP comments with meta_key = "rating".)

import { wc } from '../wp';
import { upsertBatched, lookupManyByWpId } from '../sb';

interface WcReview {
  id: number;
  product_id: number;
  status: 'approved' | 'hold' | 'spam' | 'unapproved' | 'trash';
  reviewer: string;
  reviewer_email?: string;
  rating: number;
  review: string;
  date_created: string;
  verified?: boolean;
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const reviews: WcReview[] = [];
  for await (const r of wc.paginate<WcReview>('/products/reviews', { per_page: 100, orderby: 'id', order: 'asc' })) {
    reviews.push(r);
  }
  if (reviews.length === 0) return { imported: 0, skipped: 0, errors };

  const productMap = await lookupManyByWpId('products', 'wp_product_id', reviews.map(r => r.product_id));

  const rows = reviews
    .map(r => {
      const productId = productMap.get(r.product_id);
      if (!productId) return null;
      return {
        legacy_wp_comment_id: r.id,
        product_id:           productId,
        author_name:          r.reviewer || 'Anonymous',
        rating:               Math.max(1, Math.min(5, r.rating || 5)),
        body:                 r.review?.replace(/<[^>]*>/g, '').trim() || '(no comment)',
        approved:             r.status === 'approved',
        created_at:           r.date_created ? new Date(r.date_created).toISOString() : undefined,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const ins = await upsertBatched('product_reviews', rows, { onConflict: 'legacy_wp_comment_id' });
  errors.push(...ins.errors);
  return { imported: ins.inserted, skipped: reviews.length - rows.length, errors };
}
