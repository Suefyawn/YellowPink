export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { createCollection, deleteCollection } from '@/app/admin/collection-actions';

interface CollectionRow {
  id: string; slug: string; title: string; type: 'manual' | 'smart'; status: 'published' | 'draft'; sort_order: number;
}

export default async function CollectionsPage({ searchParams }: { searchParams?: Promise<{ error?: string; deleted?: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.view')) {
    return <NoAccess section="Collections" />;
  }
  const sp = (await searchParams) ?? {};
  const admin = supabaseAdmin();
  const [{ data: colData }, { data: mapData }] = await Promise.all([
    admin.from('collections').select('id, slug, title, type, status, sort_order').order('sort_order').order('title'),
    admin.from('collection_products').select('collection_id'),
  ]);
  const collections = (colData ?? []) as CollectionRow[];
  const counts = new Map<string, number>();
  for (const r of (mapData ?? []) as Array<{ collection_id: string }>) counts.set(r.collection_id, (counts.get(r.collection_id) ?? 0) + 1);
  const canEdit = !session || session.isOwner || session.permissions.includes('products.edit');

  const inp: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Collections</h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#6b7280' }}>
        {collections.length} collection{collections.length !== 1 ? 's' : ''} · Curated product groups with their own landing page.
        <strong> Manual</strong> = hand-picked list; <strong>Smart</strong> = auto-updates from rules (tag / brand / price …).
      </p>

      {sp.error && (
        <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{sp.error}</div>
      )}
      {sp.deleted && (
        <div role="status" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>Collection deleted.</div>
      )}

      {canEdit && (
        <div style={{ background: 'white', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>New collection</h2>
          <form action={createCollection} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input name="title" required placeholder="e.g. Summer Glow Edit" style={{ ...inp, minWidth: 220 }} />
            <select name="type" style={inp} defaultValue="manual">
              <option value="manual">Manual (hand-pick)</option>
              <option value="smart">Smart (rules)</option>
            </select>
            <button type="submit" style={{ padding: '8px 18px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>+ Create</button>
          </form>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {collections.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>No collections yet. Create one above.</div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Collection', 'Type', 'Products', 'Status', ''].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {collections.map((c, i) => (
                <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td data-label="Collection" style={{ padding: '12px 16px' }}>
                    <Link href={`/admin/collections/${c.id}`} style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', textDecoration: 'none' }}>{c.title}</Link>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: '#9ca3af' }}>/collection/{c.slug}</div>
                  </td>
                  <td data-label="Type" style={{ padding: '12px 16px', fontSize: '0.8125rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: c.type === 'smart' ? '#ede9fe' : '#e0f2fe', color: c.type === 'smart' ? '#5b21b6' : '#075985' }}>{c.type}</span>
                  </td>
                  <td data-label="Products" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151' }}>
                    {c.type === 'manual' ? (counts.get(c.id) ?? 0) : <span style={{ color: '#9ca3af' }}>rules</span>}
                  </td>
                  <td data-label="Status" style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: c.status === 'published' ? '#f0fdf4' : '#f3f4f6', color: c.status === 'published' ? '#15803d' : '#9ca3af' }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Link href={`/admin/collections/${c.id}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none' }}>Edit</Link>
                      {canEdit && <DeleteButton id={c.id} action={deleteCollection} confirmMsg={`Delete collection "${c.title}"?`} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
