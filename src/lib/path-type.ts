// Classify a storefront path by the kind of content it serves — lets the
// URL-centric admin tools (Indexing, Broken links) filter "just the
// products" or "just the blog" instead of one undifferentiated path list.
export type PathType = 'product' | 'blog' | 'brand' | 'collection' | 'page' | 'other';

export const PATH_TYPE_LABELS: Record<PathType, string> = {
  product: 'Products',
  blog: 'Blog',
  brand: 'Brands',
  collection: 'Collections',
  page: 'Pages',
  other: 'Other',
};

// Soft chip colours, aligned with the admin's DotChip palette.
export const PATH_TYPE_COLORS: Record<PathType, string> = {
  product: '#C5286A',
  blog: '#6366f1',
  brand: '#0ea5e9',
  collection: '#8b5cf6',
  page: '#0369a1',
  other: '#6b7280',
};

export function classifyPath(path: string): PathType {
  if (path.startsWith('/product/')) return 'product';
  if (path.startsWith('/blog/') || path === '/blog') return 'blog';
  if (path.startsWith('/brand/') || path === '/brands') return 'brand';
  if (path.startsWith('/collection/') || path === '/collections') return 'collection';
  if (path.startsWith('/page/') || path.startsWith('/medical-review-board')) return 'page';
  return 'other';
}
