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
import { ManualOrderForm, type PickerProduct, type PickerVendor, type ShippingSuggestion } from './ManualOrderForm';

export default async function NewOrderPage() {
  const session = await getStaffSession();
  if (lacksPermission(session, 'orders.edit')) return <NoAccess section="Orders" />;

  const admin = supabaseAdmin();
  const [{ data: products }, { data: variantRows }, { data: vendorRows }, { data: provinceZones }, { data: rates }, settings] = await Promise.all([
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
    getSiteSettings(),
  ]);

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
      <ManualOrderForm
        products={withVariants}
        vendors={(vendorRows ?? []) as PickerVendor[]}
        shipping={shipping}
      />
    </div>
  );
}
