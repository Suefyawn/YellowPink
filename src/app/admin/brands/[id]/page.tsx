export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { updateBrand } from '@/app/admin/brand-actions';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { faqsToText, type Faq } from '@/lib/faqs';

interface BrandRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  status: 'published' | 'draft';
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  content_html: string | null;
  faqs: Faq[] | null;
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box' };

export default async function EditBrandPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    return <NoAccess section="Brands" />;
  }
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const admin = supabaseAdmin();

  const { data: brandData } = await admin.from('brands').select('*').eq('id', id).maybeSingle();
  if (!brandData) notFound();
  const b = brandData as BrandRow;

  // Product count for the live-link preview + a sense of scale on the page.
  const { count: productCount } = await admin
    .from('products').select('*', { count: 'exact', head: true })
    .eq('status', 'published').eq('brand', b.name);

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/brands" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>← Brands</Link>
      </div>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{b.name}</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#9ca3af' }}>
            {productCount ?? 0} product{productCount === 1 ? '' : 's'} carry this brand string · <code style={{ fontSize: '0.75rem' }}>/brand/{b.slug}</code>
          </p>
        </div>
        {b.status === 'published' && (
          <Link href={`/brand/${b.slug}`} target="_blank" style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none', fontWeight: 600 }}>View live →</Link>
        )}
      </div>

      {sp.saved && <div role="status" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>Saved.</div>}
      {sp.error && <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{sp.error}</div>}

      <form action={updateBrand.bind(null, id)} style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '24px 28px', maxWidth: 1000 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Settings</h2>

        {/* Identity */}
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Display name *</label>
            <input name="name" required defaultValue={b.name} style={inp} />
            <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>Must exactly match the <code>brand</code> string on the products that should appear under this brand.</p>
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select name="status" defaultValue={b.status} style={inp}>
              <option value="published">Published (live)</option>
              <option value="draft">Draft (hidden landing page)</option>
            </select>
            <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>Draft hides only the metadata-enriched landing page; products keep showing under the brand filter.</p>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Description</label>
          <textarea name="description" defaultValue={b.description ?? ''} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="One short paragraph for the landing-page hero. Speak to who the brand is and what it's known for, keep it factual." />
          <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>If empty, the page falls back to a generic one-liner.</p>
        </div>

        {/* Assets */}
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 14, alignItems: 'start' }}>
          <div>
            <ImageUpload name="logo_url" currentUrl={b.logo_url} label="Brand logo (square)" aspect={1} />
            <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>Use the brand&apos;s own logo asset (transparent PNG works best). Leave empty to fall back to a representative product image.</p>
          </div>
          <div>
            <ImageUpload name="hero_image_url" currentUrl={b.hero_image_url} label="Landing-page hero" aspect={16 / 9} />
            <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>Wide image shown behind the brand title. Leave empty to auto-use a member product image.</p>
          </div>
        </div>

        {/* Long-form landing-page content */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Page content (HTML)</label>
          <textarea name="content_html" defaultValue={b.content_html ?? ''} rows={12} style={{ ...inp, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }} placeholder={'<h2>About the brand</h2>\n<p>…</p>\n<h2>What we stock</h2>\n<p>…</p>'} />
          <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>Rendered under the product grid on the brand page. Use h2/h3/p/ul/a tags; link products with <code>/product/&lt;slug&gt;</code>. Makes the page rank for brand searches, treat it like a mini article.</p>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>FAQs</label>
          <textarea name="faqs_text" defaultValue={faqsToText(b.faqs)} rows={8} style={{ ...inp, resize: 'vertical' }} placeholder={'Q: Are these products original?\nA: Yes, every item is sourced through authorised distribution.\n\nQ: Is cash on delivery available?\nA: Yes, nationwide.'} />
          <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>Alternating <code>Q:</code> and <code>A:</code> lines, blank line between pairs. Shown as an FAQ section and sent to Google as FAQ structured data.</p>
        </div>

        {/* Order + SEO */}
        <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={lbl}>Sort order</label><input name="sort_order" type="number" defaultValue={b.sort_order} style={inp} /></div>
          <div /> {/* spacer */}
          <div><label style={lbl}>SEO title</label><input name="seo_title" defaultValue={b.seo_title ?? ''} style={inp} placeholder="defaults to “Brand, Shop”" /></div>
          <div><label style={lbl}>SEO description</label><input name="seo_description" defaultValue={b.seo_description ?? ''} style={inp} /></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
          <p style={{ margin: 0, fontSize: '0.6875rem', color: '#9ca3af' }}>
            The slug <code>{b.slug}</code> is frozen at creation, changing it would orphan the products that join by this name.
          </p>
          <button type="submit" style={{ padding: '8px 18px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Save</button>
        </div>
      </form>
    </div>
  );
}
