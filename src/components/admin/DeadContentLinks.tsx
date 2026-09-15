import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { findDeadLinks, rankDeadLinks, type CatalogueStatus, type DeadLink } from '@/lib/internal-links';

// Links in published articles that point at something a shopper cannot reach.
//
// The 404 table above this is REACTIVE: a link appears there only once a real
// visitor has hit it, by which time the store has already lost that visit.
// This block is the proactive half, computed from the catalogue rather than
// from traffic, so a link that breaks today shows up today.
//
// It is the check that was missing on 14 Sep, when archiving one brand broke
// five links, two of them on the store's single biggest entry point.

const REASON_COPY: Record<DeadLink['reason'], { label: string; hint: string; color: string; bg: string }> = {
  draft: {
    label: 'Draft',
    hint: 'Unpublished. Publish it, or point the article somewhere else.',
    color: '#b45309', bg: '#fef3c7',
  },
  archived: {
    label: 'Archived',
    hint: 'Deliberately retired. The article needs a different product.',
    color: '#9333ea', bg: '#f3e8ff',
  },
  missing: {
    label: 'No such product',
    hint: 'Nothing has this slug. Usually a typo in the link.',
    color: '#dc2626', bg: '#fee2e2',
  },
};

export async function DeadContentLinks() {
  const db = supabaseAdmin();
  const [{ data: posts }, { data: products }, { data: collections }] = await Promise.all([
    db.from('blog_posts').select('slug, body'),
    db.from('products').select('slug, status'),
    db.from('collections').select('slug, status'),
  ]);

  const productMap = new Map<string, CatalogueStatus>(
    (products ?? []).map(p => [p.slug as string, p.status as CatalogueStatus]),
  );
  // Collections do not all carry a status column in every environment; only
  // build the map when the rows actually have one, so findDeadLinks is not
  // handed a map that would mark every collection link dead.
  const collectionRows = (collections ?? []).filter(c => typeof c.status === 'string');
  const collectionMap = collectionRows.length
    ? new Map<string, CatalogueStatus>(collectionRows.map(c => [c.slug as string, c.status as CatalogueStatus]))
    : undefined;

  const dead = rankDeadLinks(
    (posts ?? []).flatMap(p => findDeadLinks(p.slug as string, p.body as string | null, productMap, collectionMap)),
  );

  const card: React.CSSProperties = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginTop: 32 };
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' };
  const td: React.CSSProperties = { padding: '10px', fontSize: '0.8125rem', color: '#111827', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' };

  const totalHits = dead.reduce((n, d) => n + d.occurrences, 0);

  return (
    <div style={card}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem' }}>Articles linking to products nobody can buy</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          Checked against the catalogue just now, not against traffic. These break the moment a product is drafted or archived,
          so they show up here before a customer finds them.
        </div>
      </div>

      {dead.length === 0 ? (
        <div style={{ padding: '28px 24px', textAlign: 'center', background: '#f0fdf4', color: '#166534', fontSize: '0.9375rem' }}>
          Every product and collection linked from a post is published.
        </div>
      ) : (
        <>
          <div style={{ padding: '12px 18px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: '0.8125rem', color: '#92400e' }}>
            <strong>{dead.length}</strong> dead {dead.length === 1 ? 'target' : 'targets'} across{' '}
            <strong>{new Set(dead.map(d => d.source)).size}</strong>{' '}
            {new Set(dead.map(d => d.source)).size === 1 ? 'article' : 'articles'}, appearing <strong>{totalHits}</strong>{' '}
            {totalHits === 1 ? 'time' : 'times'} in total.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Article</th>
                  <th style={th}>Links to</th>
                  <th style={th}>Why it fails</th>
                  <th style={{ ...th, textAlign: 'right' }}>Times</th>
                </tr>
              </thead>
              <tbody>
                {dead.map(d => {
                  const copy = REASON_COPY[d.reason];
                  return (
                    <tr key={`${d.source}:${d.kind}:${d.slug}`}>
                      <td style={td}>
                        <Link href={`/blog/${d.source}`} target="_blank" style={{ color: '#C5286A', fontWeight: 600 }}>/{d.source}</Link>
                      </td>
                      <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>
                        /{d.kind}/{d.slug}
                      </td>
                      <td style={td}>
                        <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600, color: copy.color, background: copy.bg, marginRight: 8 }}>
                          {copy.label}
                        </span>
                        <span style={{ color: '#6b7280' }}>{copy.hint}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{d.occurrences}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
