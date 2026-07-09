import { ProductGridSkeleton } from '@/components/ui/Skeleton';

// Streamed loading state for /tag/[slug]. Rendered instantly while the server
// resolves the tag + its products, so the visitor sees the listing shape
// instead of a blank page.

export default function Loading() {
  return (
    <main className="fade-in">
      <section style={{ padding: '32px 0 0' }}>
        <div className="container">
          <div className="skeleton" style={{ width: 100, height: 14, borderRadius: 4, marginBottom: 12 }} />
          <div className="skeleton" style={{ width: 260, height: 36, borderRadius: 6, marginBottom: 28 }} />
          <ProductGridSkeleton count={8} columns={4} />
        </div>
      </section>
    </main>
  );
}
