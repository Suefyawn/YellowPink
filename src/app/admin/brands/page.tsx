export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { BrandsSearch } from '@/components/admin/BrandsSearch';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { createBrand, deleteBrand } from '@/app/admin/brand-actions';
import { brandSlug } from '@/lib/brands';
import { DotChip } from '@/components/admin/OrderChips';
import { KpiCard } from '@/components/admin/insights/KpiCard';

interface BrandRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  status: 'published' | 'draft';
  sort_order: number;
}

export default async function AdminBrandsPage({ searchParams }: { searchParams?: Promise<{ error?: string; deleted?: string; q?: string }> }) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.view'))) {
    return <NoAccess section="Brands" />;
  }
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? '').trim();
  const admin = supabaseAdmin();

  // Brands table + product-brand distribution (for counts + the unbranded
  // queue). The product join is by name match (case-sensitive, since that's
  // how it's stored) so we don't show a count for a brand record that no
  // product actually carries.
  let brandQuery = admin.from('brands').select('id, slug, name, description, logo_url, hero_image_url, status, sort_order');
  if (q) {
    // Strip PostgREST .or() delimiters from the term, same as orders search.
    const term = q.replace(/[(),*]/g, ' ').trim();
    if (term) brandQuery = brandQuery.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  }
  const [{ data: brandData }, { data: prodData }] = await Promise.all([
    brandQuery.order('sort_order').order('name'),
    admin.from('products').select('brand, status').eq('status', 'published'),
  ]);
  const brands = (brandData ?? []) as BrandRow[];
  const productBrandCounts = new Map<string, number>();
  let unbrandedCount = 0;
  for (const r of (prodData ?? []) as Array<{ brand: string | null }>) {
    if (!r.brand) { unbrandedCount += 1; continue; }
    productBrandCounts.set(r.brand, (productBrandCounts.get(r.brand) ?? 0) + 1);
  }

  // Detect product.brand strings that have no metadata row, orphans the
  // owner can either add a row for, or fix the typo on the products.
  const knownNames = new Set(brands.map(b => b.name));
  const orphanBrandStrings = [...productBrandCounts.entries()]
    .filter(([name]) => !knownNames.has(name))
    .sort((a, b) => b[1] - a[1]);

  const canEdit = session.isOwner || session.permissions.includes('products.edit');

  // Backfill counters, the "incomplete" set the owner can plough through.
  const needsDescription = brands.filter(b => !b.description).length;
  const needsLogo = brands.filter(b => !b.logo_url).length;
  const needsHero = brands.filter(b => !b.hero_image_url).length;

  const inp: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Brands</h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#6b7280', maxWidth: 720 }}>
        {brands.length} brand{brands.length !== 1 ? 's' : ''} · Each brand gets a landing page at <code>/brand/&lt;slug&gt;</code> built from the products that carry its name. Add a description, logo, and hero to make the page sing, until then the page falls back to a templated description and a representative product image.
      </p>

      {sp.error && (
        <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{sp.error}</div>
      )}
      {sp.deleted && (
        <div role="status" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>Brand deleted.</div>
      )}

      {/* Backfill summary ─ surfaces exactly the kind of "incomplete" the
          owner flagged. Owners and product editors can act on each. */}
      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total brands', value: brands.length, accent: '#111827' },
          { label: 'Need description', value: needsDescription, accent: needsDescription ? '#b45309' : '#15803d' },
          { label: 'Need logo', value: needsLogo, accent: needsLogo ? '#b45309' : '#15803d' },
          { label: 'Need hero', value: needsHero, accent: needsHero ? '#b45309' : '#15803d' },
          { label: 'Unbranded products', value: unbrandedCount, accent: unbrandedCount ? '#b91c1c' : '#15803d' },
        ].map(s => (
          <KpiCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
        ))}
      </div>

      {canEdit && (
        <div style={{ background: 'white', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>New brand</h2>
          <form action={createBrand} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input name="name" required placeholder="e.g. CeraVe" style={{ ...inp, minWidth: 220 }} />
            <input name="slug" placeholder="optional, auto from name" style={{ ...inp, minWidth: 200, fontFamily: 'monospace' }} />
            <button type="submit" style={{ padding: '8px 18px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>+ Create</button>
          </form>
          <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            The slug is the public URL (<code>/brand/&lt;slug&gt;</code>) and the join key. It must match products&apos; <code>brand</code> string when slugified, leave blank to auto-derive.
          </p>
        </div>
      )}

      {/* Orphan brands ─ on products but missing a metadata row. Hidden while
          searching: a filtered brand list would misreport known names as
          orphans. */}
      {!q && orphanBrandStrings.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: '0.875rem', fontWeight: 700, color: '#92400e' }}>
            {orphanBrandStrings.length} brand{orphanBrandStrings.length === 1 ? '' : 's'} on products without metadata
          </h2>
          <p style={{ margin: '0 0 10px', fontSize: '0.8125rem', color: '#92400e' }}>
            These brand strings appear on published products but have no row here, add one to enable a proper landing page.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {orphanBrandStrings.map(([name, count]) => (
              <form key={name} action={createBrand} style={{ margin: 0 }}>
                <input type="hidden" name="name" value={name} />
                <input type="hidden" name="slug" value={brandSlug(name)} />
                <button type="submit" style={{
                  padding: '4px 10px', background: 'white', border: '1px solid #fde68a', borderRadius: 16,
                  fontSize: '0.75rem', color: '#92400e', cursor: 'pointer',
                }}>
                  + {name} <span style={{ color: '#b45309', fontWeight: 600 }}>({count})</span>
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Suspense fallback={null}>
          <BrandsSearch />
        </Suspense>
        {q && (
          <Link href="/admin/brands" style={{
            padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
            fontSize: '0.8125rem', color: '#6b7280', background: 'white', textDecoration: 'none',
          }}>
            Clear
          </Link>
        )}
        {q && (
          <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>
            {brands.length} match{brands.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {brands.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            {q ? 'No brands match this search.' : 'No brands yet. Create one above.'}
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Brand', 'Products', 'Assets', 'Status', ''].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brands.map((b, i) => {
                const productCount = productBrandCounts.get(b.name) ?? 0;
                const missing: string[] = [];
                if (!b.description) missing.push('copy');
                if (!b.logo_url) missing.push('logo');
                if (!b.hero_image_url) missing.push('hero');
                return (
                  <tr key={b.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Brand" style={{ padding: '12px 16px' }}>
                      <Link href={`/admin/brands/${b.id}`} style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', textDecoration: 'none' }}>{b.name}</Link>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: '#9ca3af' }}>/brand/{b.slug}</div>
                    </td>
                    <td data-label="Products" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: productCount === 0 ? '#dc2626' : '#374151' }}>
                      {productCount}
                    </td>
                    <td data-label="Assets" style={{ padding: '12px 16px' }}>
                      {missing.length === 0 ? (
                        <DotChip label="Complete" color="#15803d" />
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#b45309' }}>Needs {missing.join(' · ')}</span>
                      )}
                    </td>
                    <td data-label="Status" style={{ padding: '12px 16px' }}>
                      <DotChip label={b.status === 'published' ? 'Published' : 'Draft'} color={b.status === 'published' ? '#15803d' : '#6b7280'} />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <Link href={`/admin/brands/${b.id}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none' }}>Edit</Link>
                        {canEdit && <DeleteButton id={b.id} action={deleteBrand} confirmMsg={`Delete the metadata for "${b.name}"? Products keep their brand string and the landing page will fall back to the templated description.`} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
