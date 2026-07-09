import { ProductGridSkeleton } from '@/components/ui/Skeleton';

// Streamed loading state for /brand/[slug]. Rendered instantly while the
// server resolves the brand + its products, so the visitor sees the listing
// shape (brand header + grid) instead of a blank page.

export default function Loading() {
  return (
    <main className="fade-in">
      <section style={{ padding: '32px 0 0' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <div className="skeleton" style={{ width: 72, height: 72, borderRadius: 12 }} />
            <div>
              <div className="skeleton" style={{ width: 220, height: 30, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 140, height: 14, borderRadius: 4 }} />
            </div>
          </div>
          <ProductGridSkeleton count={8} columns={4} />
        </div>
      </section>
    </main>
  );
}
