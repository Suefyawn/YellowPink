export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { updateCollection } from '@/app/admin/collection-actions';
import { CollectionProductPicker, type PickerProduct } from '@/components/admin/CollectionProductPicker';
import { CollectionRulesEditor } from '@/components/admin/CollectionRulesEditor';
import { ALL_CATEGORIES } from '@/lib/category-taxonomy';
import { brandPlusName } from '@/lib/product-display';
import type { Collection } from '@/lib/collections';

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box' };

export default async function EditCollectionPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Collections" />;
  }
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const admin = supabaseAdmin();

  const { data: colData } = await admin.from('collections').select('*').eq('id', id).maybeSingle();
  if (!colData) notFound();
  const c = colData as Collection;

  const [{ data: prodData }, { data: mapData }, { data: tagData }] = await Promise.all([
    admin.from('products').select('id, brand, name').order('brand').order('name'),
    admin.from('collection_products').select('product_id, position').eq('collection_id', id).order('position'),
    admin.from('product_tags').select('slug, name').order('name'),
  ]);
  const allProducts: PickerProduct[] = ((prodData ?? []) as Array<{ id: string; brand: string | null; name: string }>)
    .map(p => ({ id: p.id, label: brandPlusName(p.brand, p.name) }));
  const selectedIds = ((mapData ?? []) as Array<{ product_id: string }>).map(r => r.product_id);
  const allTags = ((tagData ?? []) as Array<{ slug: string; name: string }>);
  const allBrands = Array.from(new Set(((prodData ?? []) as Array<{ brand: string | null }>).map(p => p.brand).filter((b): b is string => Boolean(b)))).sort();

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/collections" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>← Collections</Link>
      </div>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{c.title}</h1>
        {c.status === 'published' && (
          <Link href={`/collection/${c.slug}`} target="_blank" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none', fontWeight: 600 }}>View live →</Link>
        )}
      </div>

      {sp.saved && <div role="status" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>Saved.</div>}
      {sp.error && <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{sp.error}</div>}

      {/* Settings */}
      <form action={updateCollection.bind(null, id)} style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '24px 28px', maxWidth: 1000 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Settings</h2>
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={lbl}>Title *</label><input name="title" required defaultValue={c.title} style={inp} /></div>
          <div><label style={lbl}>Slug</label><input name="slug" defaultValue={c.slug} style={inp} placeholder="auto from title" /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Description</label>
          <textarea name="description" defaultValue={c.description ?? ''} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Shown on the collection page hero." />
        </div>
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={lbl}>Hero image URL</label><input name="hero_image_url" defaultValue={c.hero_image_url ?? ''} style={inp} placeholder="https://…" /></div>
          <div><label style={lbl}>Sort order</label><input name="sort_order" type="number" defaultValue={c.sort_order} style={inp} /></div>
        </div>
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Type</label>
            <select name="type" defaultValue={c.type} style={inp}>
              <option value="manual">Manual (hand-pick products)</option>
              <option value="smart">Smart (rules)</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select name="status" defaultValue={c.status} style={inp}>
              <option value="draft">Draft (hidden)</option>
              <option value="published">Published (live)</option>
            </select>
          </div>
        </div>

        {/* SEO */}
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={lbl}>SEO title</label><input name="seo_title" defaultValue={c.seo_title ?? ''} style={inp} placeholder="defaults to “Title — Shop”" /></div>
          <div><label style={lbl}>SEO description</label><input name="seo_description" defaultValue={c.seo_description ?? ''} style={inp} /></div>
        </div>

        {/* Smart rules (only meaningful for smart collections; saved with the form) */}
        {c.type === 'smart' && (
          <div style={{ marginTop: 8, marginBottom: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>Smart rules</h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#9ca3af' }}>Membership updates automatically as products change.</p>
            <CollectionRulesEditor initialRules={c.rules ?? {}} allTags={allTags} allBrands={allBrands} allCategories={[...ALL_CATEGORIES]} />
          </div>
        )}

        <button type="submit" style={{ marginTop: 8, padding: '10px 22px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Save settings</button>
      </form>

      {/* Manual product picker */}
      {c.type === 'manual' && (
        <CollectionProductPicker collectionId={id} allProducts={allProducts} initialSelectedIds={selectedIds} />
      )}
    </div>
  );
}
