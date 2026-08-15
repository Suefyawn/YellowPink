export const dynamic = 'force-dynamic';

// Manual order entry — phone/WhatsApp/DM orders keyed in by staff. The
// command palette's "New order" entry has pointed here since day one; this
// page makes it real.

import Link from 'next/link';
import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { lacksPermission } from '@/lib/admin-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { parseCommerceConfig } from '@/lib/commerce';
import { ManualOrderForm, type InitialDraft, type PickerProduct, type PickerVendor, type ShippingSuggestion } from './ManualOrderForm';
import { deleteOrderDraft, type DraftPayload } from './draft-actions';

interface DraftRow {
  id: string;
  payload: unknown;
  customer_name: string | null;
  note: string | null;
  created_by: string | null;
  updated_at: string;
}

// Item count (units) + subtotal straight off the stored payload, guarded
// field by field — the card must survive any historical payload shape.
function summarizeDraft(payload: unknown): { items: number; subtotal: number } {
  const lines = (payload as { lines?: unknown } | null)?.lines;
  let items = 0, subtotal = 0;
  if (Array.isArray(lines)) {
    for (const l of lines) {
      const qty = Math.max(0, Number((l as { qty?: unknown } | null)?.qty) || 0);
      const price = Math.max(0, Number((l as { price?: unknown } | null)?.price) || 0);
      items += qty;
      subtotal += qty * price;
    }
  }
  return { items, subtotal };
}

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const session = await getStaffSession();
  if (lacksPermission(session, 'orders.edit')) return <NoAccess section="Orders" />;
  const { draft: draftParam } = await searchParams;

  const admin = supabaseAdmin();
  const [{ data: products }, { data: variantRows }, { data: vendorRows }, { data: provinceZones }, { data: rates }, { data: draftRows }, settings] = await Promise.all([
    admin
      .from('products')
      .select('id, name, brand, price, stock, track_inventory, vendor_id')
      .eq('status', 'published')
      .order('name'),
    // Shades/sizes. A phone order for "NARS foundation" has to name WHICH
    // shade: place_order charges the variant's price and debits the variant's
    // stock, and this form was doing neither.
    admin
      .from('product_variants')
      .select('id, product_id, sku, price, stock, enabled, variant_attribute_values(attribute_values(value))')
      .eq('enabled', true)
      .order('sort_order'),
    // Active vendors for the optional "Fulfilled by vendor" picker; the
    // commission % powers the client-side cost/margin preview.
    admin.from('vendors').select('id, name, commission_pct').eq('active', true).order('name'),
    admin.from('province_zones').select('province, zone_id'),
    admin.from('shipping_rates').select('zone_id, rate, free_shipping_threshold').order('rate'),
    // Saved drafts for the card above the form, newest activity first.
    admin
      .from('draft_orders')
      .select('id, payload, customer_name, note, created_by, updated_at')
      .order('updated_at', { ascending: false })
      .limit(25),
    getSiteSettings(),
  ]);

  const drafts = (draftRows ?? []) as DraftRow[];
  // ?draft=<id> → resume: that row's payload becomes the form's initial state.
  // Usually already in the card's page of rows; fetched directly otherwise.
  let activeDraft = draftParam ? drafts.find(dr => dr.id === draftParam) ?? null : null;
  if (!activeDraft && draftParam && /^[0-9a-f-]{36}$/i.test(draftParam)) {
    const { data } = await admin
      .from('draft_orders')
      .select('id, payload, customer_name, note, created_by, updated_at')
      .eq('id', draftParam)
      .maybeSingle();
    activeDraft = (data as DraftRow | null) ?? null;
  }
  const initialDraft: InitialDraft | null = activeDraft && activeDraft.payload && typeof activeDraft.payload === 'object'
    ? { id: activeDraft.id, payload: activeDraft.payload as DraftPayload, note: activeDraft.note }
    : null;

  // Cheapest rate per zone → suggestion per province (mirrors place_order's
  // floor logic; the form only *suggests*, staff can type anything ≥ 0).
  const cheapestByZone = new Map<string, { rate: number; threshold: number | null }>();
  for (const r of (rates ?? []) as Array<{ zone_id: string; rate: number; free_shipping_threshold: number | null }>) {
    if (!cheapestByZone.has(r.zone_id)) cheapestByZone.set(r.zone_id, { rate: r.rate, threshold: r.free_shipping_threshold });
  }
  const byProvince: ShippingSuggestion['byProvince'] = {};
  for (const pz of (provinceZones ?? []) as Array<{ province: string; zone_id: string }>) {
    const z = cheapestByZone.get(pz.zone_id);
    if (z) byProvince[pz.province] = z;
  }
  const cfg = parseCommerceConfig(settings);
  const shipping: ShippingSuggestion = {
    byProvince,
    defaultRate: cfg.defaultShippingRate,
    defaultThreshold: cfg.freeShippingThreshold,
    freeEnabled: cfg.freeShippingEnabled,
  };

  // Attach each product's shades, with a readable label built from its
  // attribute values ("Shade: Mont Blanc"), falling back to the SKU so a
  // variant is never a nameless row in the picker.
  type RawVariant = {
    id: string; product_id: string; sku: string | null; price: number; stock: number | null;
    variant_attribute_values?: Array<{ attribute_values?: { value?: string | null } | null }> | null;
  };
  const variantsByProduct = new Map<string, PickerProduct['variants']>();
  for (const v of (variantRows ?? []) as RawVariant[]) {
    const label = (v.variant_attribute_values ?? [])
      .map(x => x.attribute_values?.value)
      .filter((x): x is string => Boolean(x))
      .join(' · ') || v.sku || 'Option';
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push({ id: v.id, label, price: v.price, stock: v.stock });
    variantsByProduct.set(v.product_id, list);
  }
  const withVariants: PickerProduct[] = ((products ?? []) as Omit<PickerProduct, 'variants'>[])
    .map(p => ({ ...p, variants: variantsByProduct.get(p.id) ?? [] }));

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ marginBottom: 20 }}>
        <div>
          <Link href="/admin/orders" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>← Orders</Link>
          <h1 style={{ margin: '4px 0 4px', fontSize: '1.5rem', fontWeight: 700 }}>New manual order</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
            For orders taken over WhatsApp, phone, or DMs. Stock is reserved through the
            inventory ledger exactly like a storefront order.
          </p>
        </div>
      </div>
      {drafts.length > 0 && (
        <section style={{ maxWidth: 860, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            Drafts
          </h2>
          <p style={{ margin: '4px 0 6px', color: '#6b7280', fontSize: '0.75rem' }}>
            Saved manual orders waiting to be completed. Resume one to load it into the form below.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {drafts.map(dr => {
              const sum = summarizeDraft(dr.payload);
              const resumed = dr.id === activeDraft?.id;
              return (
                <li key={dr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {dr.customer_name || 'Unnamed draft'}
                      {resumed && (
                        <span style={{
                          marginLeft: 8, fontSize: '0.6875rem', fontWeight: 600, color: '#92400e',
                          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 999, padding: '1px 8px',
                        }}>
                          In the form below
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                      {sum.items} item{sum.items === 1 ? '' : 's'} · PKR {sum.subtotal.toLocaleString()} · saved {ago(dr.updated_at)}
                      {dr.created_by ? ` · by ${dr.created_by}` : ''}
                    </div>
                    {dr.note && (
                      <div style={{ color: '#9ca3af', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dr.note}
                      </div>
                    )}
                  </div>
                  {!resumed && (
                    <Link href={`/admin/orders/new?draft=${dr.id}`} className="adm-btn adm-btn-secondary">
                      Resume
                    </Link>
                  )}
                  <form action={deleteOrderDraft.bind(null, dr.id)}>
                    <button type="submit" className="adm-btn adm-btn-danger" aria-label={`Delete draft ${dr.customer_name || dr.id}`}>
                      Delete
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <ManualOrderForm
        key={initialDraft?.id ?? 'blank'}
        products={withVariants}
        vendors={(vendorRows ?? []) as PickerVendor[]}
        shipping={shipping}
        initialDraft={initialDraft}
      />
    </div>
  );
}
