export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { createTag, renameTag, deleteTag } from '@/app/admin/tag-actions';

interface TagRow { id: string; slug: string; name: string }

export default async function TagsPage() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.view'))) {
    return <NoAccess section="Tags" />;
  }
  const admin = supabaseAdmin();
  const [{ data: tagData }, { data: mapData }] = await Promise.all([
    admin.from('product_tags').select('id, slug, name').order('name'),
    admin.from('product_tag_map').select('tag_id'),
  ]);
  const tags = (tagData ?? []) as TagRow[];
  const counts = new Map<string, number>();
  for (const r of (mapData ?? []) as Array<{ tag_id: string }>) {
    counts.set(r.tag_id, (counts.get(r.tag_id) ?? 0) + 1);
  }
  const canEdit = !session || session.isOwner || session.permissions.includes('products.edit');

  const inp: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Tags</h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#6b7280' }}>
        {tags.length} tag{tags.length !== 1 ? 's' : ''} · Free-form labels for storefront filtering and curated edits.
        Assign them per product on the product page; manage the vocabulary here.
      </p>

      {canEdit && (
        <div style={{ background: 'white', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Add a tag</h2>
          <form action={createTag} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input name="name" required placeholder="e.g. Viral" style={{ ...inp, minWidth: 200 }} />
            <button type="submit" style={{
              padding: '8px 18px', background: '#C5286A', color: 'white',
              border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}>+ Create</button>
          </form>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {tags.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No tags yet. Add one above, or tag a product from its edit page.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Tag', 'Slug', 'Products', ''].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tags.map((t, i) => {
                const n = counts.get(t.id) ?? 0;
                return (
                  <tr key={t.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Tag" style={{ padding: '10px 16px' }}>
                      {canEdit ? (
                        <form action={renameTag} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="hidden" name="id" value={t.id} />
                          <input name="name" defaultValue={t.name} style={{ ...inp, padding: '6px 10px', fontSize: '0.8125rem', minWidth: 160 }} />
                          <button type="submit" style={{
                            padding: '6px 10px', background: 'transparent', color: '#374151',
                            border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
                          }}>Save</button>
                        </form>
                      ) : (
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{t.name}</span>
                      )}
                    </td>
                    <td data-label="Slug" style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.8125rem', color: '#6b7280' }}>
                      {t.slug}
                    </td>
                    <td data-label="Products" style={{ padding: '10px 16px', fontSize: '0.8125rem', color: '#374151' }}>
                      {n > 0 ? (
                        <Link href={`/admin/products?ptag=${encodeURIComponent(t.slug)}`} style={{ color: '#C5286A', textDecoration: 'none', fontWeight: 600 }}>
                          {n} product{n !== 1 ? 's' : ''}
                        </Link>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      {canEdit && <DeleteButton id={t.id} action={deleteTag} confirmMsg={`Delete tag "${t.name}"? It will be removed from ${n} product${n !== 1 ? 's' : ''}.`} />}
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
