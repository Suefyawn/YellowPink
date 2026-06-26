import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { brandPlusName } from '@/lib/product-display';

// Dashboard widget: the product-finder quiz funnel (start → complete → email),
// read from the first-party quiz_events log so it's reliable and immediate
// (PostHog gets the same events for deeper analysis on the Analytics page).

interface EventRow { type: string; branch: string | null; recommended_ids: string[] }

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export async function QuizStatsWidget() {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('quiz_events')
    .select('type, branch, recommended_ids')
    .order('created_at', { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as EventRow[];

  const starts = rows.filter(r => r.type === 'started').length;
  const completes = rows.filter(r => r.type === 'completed').length;
  const emails = rows.filter(r => r.type === 'email_captured').length;
  const rate = starts > 0 ? Math.round((completes / starts) * 100) : 0;
  const emailRate = completes > 0 ? Math.round((emails / completes) * 100) : 0;

  const completedRows = rows.filter(r => r.type === 'completed');
  const skincare = completedRows.filter(r => r.branch === 'skincare').length;
  const wellness = completedRows.filter(r => r.branch === 'wellness').length;

  // Top recommended products across all completions.
  const counts = new Map<string, number>();
  for (const r of completedRows) for (const id of r.recommended_ids ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  const topIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
  let topProducts: { id: string; label: string; n: number }[] = [];
  if (topIds.length) {
    const { data: prods } = await admin.from('products').select('id, name, brand').in('id', topIds);
    const byId = new Map((prods ?? []).map((p: { id: string; name: string; brand: string | null }) => [p.id, brandPlusName(p.brand, p.name)]));
    topProducts = topIds.map(id => ({ id, label: byId.get(id) ?? '—', n: counts.get(id) ?? 0 }));
  }

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Product finder quiz</h2>
        <Link href="/quiz" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>Open quiz →</Link>
      </div>

      {starts === 0 ? (
        <div style={{ padding: '32px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No quiz activity yet. Share <code style={{ color: '#6b7280' }}>/quiz</code> to start collecting recommendations and emails.
        </div>
      ) : (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <Stat label="Starts" value={starts} />
            <Stat label="Completed" value={completes} sub={`${rate}% completion`} />
            <Stat label="Emails" value={emails} sub={`${emailRate}% of completions`} />
            <Stat label="Split" value={`${skincare}/${wellness}`} sub="skincare / wellness" />
          </div>
          {topProducts.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Most recommended</div>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                {topProducts.map(p => (
                  <li key={p.id} style={{ fontSize: '0.8125rem', color: '#374151' }}>
                    {p.label} <span style={{ color: '#9ca3af' }}>· {p.n}×</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
