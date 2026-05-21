import { Skeleton } from '@/components/ui/Skeleton';

// Shared loading skeleton for every admin route — Next renders this in the
// AdminShell content area while a page's data is fetching, so admin pages
// fade in instead of flashing blank/partial. Generic on purpose: a page
// header, a stat-card row and a list stand in for most admin screens.
export default function AdminLoading() {
  return (
    <div className="adm-page" style={{ padding: '32px 36px' }} aria-busy="true" aria-label="Loading">
      <Skeleton height={26} width={190} style={{ marginBottom: 10 }} />
      <Skeleton height={13} width={300} style={{ marginBottom: 28 }} />

      <div
        className="adm-stat-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}
      >
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} height={94} radius={10} />
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px',
              borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
            }}
          >
            <Skeleton height={40} width={40} radius={8} />
            <Skeleton height={13} width="34%" />
            <Skeleton height={13} width="18%" style={{ marginLeft: 'auto' }} />
            <Skeleton height={24} width={64} radius={20} />
          </div>
        ))}
      </div>
    </div>
  );
}
