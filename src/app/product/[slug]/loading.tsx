import { Skeleton } from '@/components/ui/Skeleton';

// PDP streaming fallback. Gallery + details layout mirrors PDPPage's grid so
// the layout doesn't shift when the real data arrives.

export default function Loading() {
  return (
    <main className="fade-in">
      <section style={{ padding: '32px 0' }}>
        <div
          className="container pdp-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 0.9fr',
            gap: 'var(--gutter)',
            alignItems: 'start',
          }}
        >
          {/* Gallery skeleton */}
          <div>
            <div
              className="skeleton"
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 'var(--radius-card)',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} height={80} radius="var(--radius-card)" />
              ))}
            </div>
          </div>

          {/* Details skeleton */}
          <div style={{ padding: '8px 0 0' }}>
            <Skeleton height={14} width="35%" style={{ marginBottom: 8 }} />
            <Skeleton height={36} width="80%" style={{ marginBottom: 12 }} />
            <Skeleton height={18} width="55%" style={{ marginBottom: 24 }} />
            <Skeleton height={16} width="100%" style={{ marginBottom: 8 }} />
            <Skeleton height={16} width="92%" style={{ marginBottom: 8 }} />
            <Skeleton height={16} width="78%" style={{ marginBottom: 24 }} />
            <Skeleton height={48} width="100%" radius={6} />
          </div>
        </div>
      </section>
    </main>
  );
}
