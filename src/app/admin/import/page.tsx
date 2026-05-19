export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

// Admin surface for the WordPress → Supabase import. Running the import is
// a long-lived CLI job (downloads images, walks paginated WC endpoints — can
// take 10–30 minutes), so this page does NOT trigger imports inline. Instead
// it shows:
//   1. What's already in the database vs. what's still empty
//   2. History of past `wp-import` runs (per-step counts + error tail)
//   3. The exact npm command + env vars to run
// The merchant runs `npm run wp-import` from their shell and refreshes this
// page to watch progress.

const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  running: { bg: '#dbeafe', color: '#1e40af' },
  success: { bg: '#dcfce7', color: '#166534' },
  partial: { bg: '#fef3c7', color: '#92400e' },
  failed:  { bg: '#fee2e2', color: '#991b1b' },
};

const STEPS: Array<{ step: string; label: string; description: string; table: string }> = [
  { step: 'categories', label: 'Categories',  description: 'Product taxonomy (hierarchical).',                                table: 'categories' },
  { step: 'attributes', label: 'Attributes',  description: 'Variant attributes + their values (shade, size, etc.).',          table: 'product_attributes' },
  { step: 'products',   label: 'Products',    description: 'Simple + variable products. Required before variations / orders.', table: 'products' },
  { step: 'variations', label: 'Variations',  description: 'Variant rows + per-variant images + option mappings.',            table: 'product_variants' },
  { step: 'coupons',    label: 'Coupons',     description: 'WooCommerce discount codes (with the new richer fields).',         table: 'coupons' },
  { step: 'customers',  label: 'Customers',   description: 'Auth users + profiles + saved addresses.',                         table: 'profiles' },
  { step: 'orders',     label: 'Orders',      description: 'Full order history + per-status events. Requires customers first.', table: 'orders' },
  { step: 'reviews',    label: 'Reviews',     description: 'Product reviews from WP comments (verified-purchase flag preserved).', table: 'product_reviews' },
  { step: 'blog',       label: 'Blog posts',  description: 'Editorial posts (WP `post` type).',                                table: 'blog_posts' },
  { step: 'pages',      label: 'CMS pages',   description: 'About, Shipping Policy, FAQ, etc.',                                table: 'pages' },
  { step: 'redirects',  label: 'Redirects',   description: 'Old WP URLs → new Next routes (301). Run last.',                   table: 'redirects' },
];

interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  counts: Record<string, { imported?: number; skipped?: number }>;
  errors: string[];
  status: 'running' | 'success' | 'partial' | 'failed';
}

export default async function ImportPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner) {
    return <NoAccess section="Import" />;
  }

  // Pull counts for each target table so the merchant can see exactly which
  // entities are still empty. Errors are non-fatal — show 0/null and move on.
  const counts: Record<string, number | null> = {};
  await Promise.all(STEPS.map(async s => {
    const { count, error } = await supabase.from(s.table).select('*', { count: 'exact', head: true });
    counts[s.table] = error ? null : (count ?? 0);
  }));

  const { data: runs } = await supabase
    .from('wp_import_runs')
    .select('id, started_at, finished_at, counts, errors, status')
    .order('started_at', { ascending: false })
    .limit(8);

  const totalImported = (runs ?? []).reduce((sum, r) => {
    return sum + Object.values((r as RunRow).counts ?? {}).reduce((s, c) => s + Number(c?.imported ?? 0), 0);
  }, 0);

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>WordPress import</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            Migrate products, variants, customers, orders, reviews, coupons, blog posts &amp; CMS pages from your live WooCommerce store.
          </p>
        </div>
      </div>

      {/* ── Step status grid ─────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 20, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Import status
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
          What&apos;s currently in Supabase. Empty rows mean that import step hasn&apos;t run yet — or there&apos;s nothing in WP to import.
        </p>

        <div
          className="adm-import-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}
        >
          {STEPS.map(s => {
            const n = counts[s.table];
            const isEmpty = n === 0;
            const isErr = n === null;
            return (
              <div
                key={s.step}
                style={{
                  padding: 14, borderRadius: 8,
                  background: isErr ? '#fef2f2' : isEmpty ? '#fffbeb' : '#f0fdf4',
                  border: `1px solid ${isErr ? '#fecaca' : isEmpty ? '#fde68a' : '#bbf7d0'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>{s.label}</span>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700,
                    color: isErr ? '#991b1b' : isEmpty ? '#92400e' : '#166534',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {isErr ? 'table missing' : isEmpty ? 'empty' : `${n!.toLocaleString()} rows`}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#374151', lineHeight: 1.4 }}>
                  {s.description}
                </div>
                <code style={{ display: 'block', marginTop: 6, fontSize: '0.6875rem', color: '#6366f1', fontFamily: 'monospace' }}>
                  npm run wp-import -- {s.step}
                </code>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── How to run ──────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 20, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          How to run the import
        </h2>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: '0.875rem', color: '#374151', lineHeight: 1.7 }}>
          <li>
            Set the WordPress connection env vars (in <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>.env.local</code> on your machine, OR Vercel env if running there):
            <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '12px 14px', borderRadius: 6, margin: '8px 0', fontSize: '0.75rem', lineHeight: 1.5, overflow: 'auto' }}>{`WP_SITE_URL=https://yellowpink.pk
WC_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxx
WC_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxx
WP_USERNAME=admin
WP_APPLICATION_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...`}</pre>
          </li>
          <li>
            Get the WooCommerce key/secret pair from WP admin → WooCommerce → Settings → Advanced → REST API → Add key. Permission: <strong>Read</strong>.
          </li>
          <li>
            Get the WordPress application password from WP admin → Users → your user → Application Passwords (needed for the /wp/v2/* endpoints).
          </li>
          <li>
            From the project root, run the full import (10–30 min depending on catalogue size):
            <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '12px 14px', borderRadius: 6, margin: '8px 0', fontSize: '0.8125rem', lineHeight: 1.5 }}>{`npm run wp-import`}</pre>
            Or just one step — the order in the status grid above is the recommended sequence:
            <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '12px 14px', borderRadius: 6, margin: '8px 0', fontSize: '0.8125rem', lineHeight: 1.5 }}>{`npm run wp-import -- products
npm run wp-import -- variations
npm run wp-import -- orders`}</pre>
          </li>
          <li>
            Refresh this page after the run — counts in the status grid update + the run will appear in History below.
          </li>
        </ol>
        <p style={{ margin: '16px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
          The importer is idempotent — every row is keyed on its original WordPress / Woo id, so re-running only upserts changed rows. Safe to re-run after a partial failure.
        </p>
      </div>

      {/* ── Run history ─────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            Run history
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            {totalImported.toLocaleString()} total rows imported across {(runs ?? []).length} run{(runs ?? []).length === 1 ? '' : 's'}
          </span>
        </div>

        {!runs || runs.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No imports have been run yet. Follow the steps above to start.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(runs as RunRow[]).map(r => {
              const counts = r.counts ?? {};
              const totalImp = Object.values(counts).reduce((s, c) => s + Number(c?.imported ?? 0), 0);
              const sc = STATUS_COLORS[r.status] ?? { bg: '#f3f4f6', color: '#374151' };
              const dur = r.finished_at
                ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)
                : null;
              return (
                <div key={r.id} style={{
                  padding: 12, border: '1px solid #f3f4f6', borderRadius: 8,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <span style={{
                    flexShrink: 0,
                    fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em',
                    padding: '3px 8px', borderRadius: 4,
                    background: sc.bg, color: sc.color, textTransform: 'uppercase',
                  }}>{r.status}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 600 }}>
                      {fmtDateTime(r.started_at)}
                      {dur !== null && (
                        <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>
                          · {dur < 60 ? `${dur}s` : `${Math.floor(dur / 60)}m ${dur % 60}s`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {Object.entries(counts).map(([step, c]) => (
                        <span key={step} title={`${step}: ${c.imported ?? 0} imported, ${c.skipped ?? 0} skipped`} style={{
                          fontFamily: 'monospace', background: '#f9fafb', padding: '2px 6px', borderRadius: 4, border: '1px solid #f3f4f6',
                        }}>
                          {step}: {c.imported ?? 0}
                        </span>
                      ))}
                      {totalImp > 0 && (
                        <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#16a34a' }}>
                          +{totalImp.toLocaleString()} rows
                        </span>
                      )}
                    </div>
                    {Array.isArray(r.errors) && r.errors.length > 0 && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626' }}>
                          {r.errors.length} error{r.errors.length === 1 ? '' : 's'}
                        </summary>
                        <pre style={{
                          margin: '6px 0 0', padding: 8, background: '#fef2f2', borderRadius: 4,
                          fontSize: '0.6875rem', color: '#991b1b', overflow: 'auto', maxHeight: 200,
                        }}>{r.errors.join('\n')}</pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p style={{ marginTop: 20, fontSize: '0.75rem', color: '#9ca3af' }}>
        Full README at <Link href="https://github.com/Suefyawn/YellowPink/blob/main/scripts/wp-import/README.md" target="_blank" style={{ color: '#6366f1' }}>scripts/wp-import/README.md</Link> · open-source, idempotent, dry-run supported via <code style={{ fontFamily: 'monospace' }}>WP_IMPORT_DRY_RUN=true</code>.
      </p>
    </div>
  );
}
