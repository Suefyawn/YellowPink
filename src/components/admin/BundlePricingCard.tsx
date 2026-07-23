import Link from 'next/link';
import { CopyButton } from '@/components/admin/CopyButton';
import { brandPlusName } from '@/lib/product-display';
import {
  bundleEconomics,
  buildVendorBundleExplainer,
  componentUnitCost,
  BUNDLE_MARGIN_FLOOR_PCT,
  type BundleComponentRow,
} from '@/lib/bundle-pricing';
import { addBundleComponent, removeBundleComponent } from '@/app/admin/products/bundle-actions';
import type { Product } from '@/types';

const PKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

// Set contents & pricing panel for bundle/combo products. One place to see
// what's inside, what the customer saves, and whether the set is profitable —
// plus the ready-to-send vendor explainer so the arrangement with NB Sons
// (and any future vendor) is always stated the same correct way.
export function BundlePricingCard({
  bundle,
  components,
  options,
}: {
  bundle: Product;
  components: BundleComponentRow[];
  options: Array<{ id: string; name: string; brand: string | null; price: number }>;
}) {
  const eco = bundleEconomics(bundle.price, components);
  const explainer = buildVendorBundleExplainer({
    bundleName: bundle.name,
    bundlePrice: bundle.price,
    components,
  });

  const marginLow = eco.marginPct != null && eco.marginPct < BUNDLE_MARGIN_FLOOR_PCT;
  const noSaving = components.length > 0 && eco.saving <= 0;

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '8px 10px', fontSize: '0.6875rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280',
    borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '10px', fontSize: '0.8125rem', color: '#111827',
    borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle',
  };
  const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: '24px 28px', marginTop: 24, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Set contents &amp; pricing</h2>
        {components.length > 0 && (
          <CopyButton value={explainer} label="Copy vendor explainer" title="Copy the WhatsApp message that explains this set to the vendor" />
        )}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
        The individual products this set contains. Feeds the storefront &ldquo;What&rsquo;s inside&rdquo; section,
        the vendor packing message on orders, and the margin check below.
      </p>

      {/* ── Guardrails ─────────────────────────────────────────────── */}
      {noSaving && (
        <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#dc2626', fontSize: '0.8125rem' }}>
          <strong>Set price isn&rsquo;t a deal:</strong> the components bought separately cost {PKR(eco.individualTotal)},
          which is {eco.saving === 0 ? 'the same as' : 'less than'} the set price of {PKR(bundle.price)}.
          Customers will notice — lower the set price or adjust the contents.
        </div>
      )}
      {components.length > 0 && eco.missingCosts.length > 0 && (
        <div role="alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#92400e', fontSize: '0.8125rem' }}>
          <strong>Margin unverifiable:</strong> no vendor cost on file
          for {eco.missingCosts.join(', ')}. Enter the cost price on each component product
          (what the vendor bills per unit) and this panel will show the set&rsquo;s real profit.
        </div>
      )}
      {marginLow && (
        <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#dc2626', fontSize: '0.8125rem' }}>
          <strong>Thin margin:</strong> {Math.round(eco.marginPct!)}% is below
          the {BUNDLE_MARGIN_FLOOR_PCT}% floor. After COD fees and returns this set may lose money —
          raise the set price or swap a component.
        </div>
      )}

      {/* ── Components table ───────────────────────────────────────── */}
      {components.length > 0 ? (
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Component</th>
                <th style={{ ...th, textAlign: 'right' }}>Qty</th>
                <th style={{ ...th, textAlign: 'right' }}>Retail (each)</th>
                <th style={{ ...th, textAlign: 'right' }}>Retail total</th>
                <th style={{ ...th, textAlign: 'right' }}>Vendor cost</th>
                <th style={th} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {components.map(c => {
                const cost = componentUnitCost(c.product);
                return (
                  <tr key={c.product.id}>
                    <td style={td}>
                      <Link href={`/admin/products/${c.product.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                        {brandPlusName(c.product.brand, c.product.name)}
                      </Link>
                      {c.product.status !== 'published' && (
                        <span style={{ marginLeft: 8, fontSize: '0.6875rem', fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 6px' }}>
                          Draft — hidden on storefront
                        </span>
                      )}
                    </td>
                    <td style={num}>{c.qty}</td>
                    <td style={num}>{PKR(c.product.price)}</td>
                    <td style={num}>{PKR(c.product.price * c.qty)}</td>
                    <td style={{ ...num, color: cost == null ? '#b45309' : '#111827' }}>
                      {cost == null ? 'not set' : PKR(cost * c.qty)}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <form action={removeBundleComponent} style={{ display: 'inline' }}>
                        <input type="hidden" name="bundle_id" value={bundle.id} />
                        <input type="hidden" name="component_id" value={c.product.id} />
                        <button
                          type="submit"
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }} colSpan={3}>Bought separately</td>
                <td style={{ ...num, fontWeight: 700, borderBottom: 'none' }}>{PKR(eco.individualTotal)}</td>
                <td style={{ ...num, fontWeight: 700, borderBottom: 'none' }}>{eco.costTotal == null ? '—' : PKR(eco.costTotal)}</td>
                <td style={{ borderBottom: 'none' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#9ca3af' }}>
          No components yet. Add the individual products this set contains — the storefront will then
          show &ldquo;What&rsquo;s inside&rdquo; with the customer&rsquo;s saving, and vendor messages will list each item for packing.
        </p>
      )}

      {/* ── Economics summary ──────────────────────────────────────── */}
      {components.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Set price', value: PKR(bundle.price), tone: 'plain' as const },
            {
              label: 'Customer saves',
              value: eco.saving > 0 ? `${PKR(eco.saving)} (${Math.round(eco.savingPct)}%)` : 'nothing',
              tone: eco.saving > 0 ? ('good' as const) : ('bad' as const),
            },
            {
              label: 'Our margin',
              value: eco.margin == null ? 'unverifiable' : `${PKR(eco.margin)} (${Math.round(eco.marginPct!)}%)`,
              tone: eco.margin == null ? ('warn' as const) : marginLow || eco.margin <= 0 ? ('bad' as const) : ('good' as const),
            },
          ].map(chip => (
            <div
              key={chip.label}
              style={{
                padding: '10px 14px', borderRadius: 8, minWidth: 150,
                border: `1px solid ${chip.tone === 'good' ? '#bbf7d0' : chip.tone === 'bad' ? '#fecaca' : chip.tone === 'warn' ? '#fde68a' : '#e5e7eb'}`,
                background: chip.tone === 'good' ? '#f0fdf4' : chip.tone === 'bad' ? '#fef2f2' : chip.tone === 'warn' ? '#fffbeb' : '#f9fafb',
              }}
            >
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280' }}>{chip.label}</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums', color: chip.tone === 'bad' ? '#dc2626' : chip.tone === 'warn' ? '#b45309' : '#111827' }}>
                {chip.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add a component ────────────────────────────────────────── */}
      <form action={addBundleComponent} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="hidden" name="bundle_id" value={bundle.id} />
        <select
          name="component_id"
          required
          defaultValue=""
          style={{ flex: '1 1 280px', minWidth: 220, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.8125rem', color: '#111827', background: 'white' }}
        >
          <option value="" disabled>Add a product to this set…</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>
              {brandPlusName(o.brand, o.name)} — {PKR(o.price)}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#6b7280' }}>
          Qty
          <input
            type="number" name="qty" defaultValue={1} min={1} max={20}
            style={{ width: 64, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.8125rem' }}
          />
        </label>
        <button
          type="submit"
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#C5286A', color: 'white', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Add to set
        </button>
      </form>

      {/* ── Vendor explainer preview ───────────────────────────────── */}
      {components.length > 0 && (
        <details style={{ marginTop: 18 }}>
          <summary style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            Preview the vendor explainer message
          </summary>
          <pre style={{ margin: '10px 0 0', padding: '12px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.75rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#374151', fontFamily: 'inherit' }}>
            {explainer}
          </pre>
          <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Send this once when introducing the set to the vendor. Individual orders already expand
            sets into a per-item packing list in the vendor WhatsApp message.
          </p>
        </details>
      )}
    </div>
  );
}
