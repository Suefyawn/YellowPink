import { ProductGridSkeleton } from '@/components/ui/Skeleton';

// Streamed loading state for /collection/[slug]. Rendered instantly while the
// server resolves the collection + its products, so the visitor sees the
// listing shape (heading + toolbar + grid) instead of a blank page.

export default function Loading() {
  return (
    <main className="fade-in">
      <section style={{ padding: '32px 0 0' }}>
        <div className="container">
          <div className="skeleton" style={{ width: 100, height: 14, borderRadius: 4, marginBottom: 12 }} />
          <div className="skeleton" style={{ width: 280, height: 36, borderRadius: 6, marginBottom: 28 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton" style={{ width: 96, height: 36, borderRadius: 100 }} />
              <div className="skeleton" style={{ width: 132, height: 36, borderRadius: 100 }} />
            </div>
            <div className="skeleton" style={{ width: 120, height: 28, borderRadius: 6 }} />
          </div>
          <ProductGridSkeleton count={12} columns={4} />
        </div>
      </section>
    </main>
  );
}
