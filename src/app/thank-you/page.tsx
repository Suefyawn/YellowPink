import type { Metadata } from 'next';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';
import { WA_TEMPLATES } from '@/lib/whatsapp';
import { getSiteSettings, supabaseAdmin } from '@/lib/supabase';
import { getDefaultEstimatedDays } from '@/lib/shipping';
import { parseBankAccounts } from '@/lib/bank-accounts';
import { BankAccountsList } from '@/components/checkout/BankAccountsList';
import { ThankYouPurchase } from './ThankYouPurchase';
import { ThankYouAccountOffer } from './ThankYouAccountOffer';
import type { BankAccount } from '@/types';

// Order-confirmation page should never be indexed, leaks order_number
// existence + lets crawlers guess valid IDs (audit SEV-2 + SEV-3).
export const metadata: Metadata = {
  title: 'Thank you',
  robots: { index: false, follow: false },
};

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const orderNumber = order ?? 'YP-??????';
  // Delivery estimate reads the live shipping default so it tracks Admin →
  // Settings → Shipping instead of a hard-coded "2-4 business days".
  const days = await getDefaultEstimatedDays();
  const deliveryEstimate = days ? `${days.min}–${days.max} business days` : 'a few business days';

  // Look up the order (orders RLS blocks anon, service-role read). We use it
  // to show the bank accounts for a bank-transfer order AND to render an order
  // summary so the customer sees what they bought without checking their email.
  // The page is noindex and the order number is required, so no new exposure.
  type OrderItem = { id?: string; slug?: string; name: string; brand?: string | null; category?: string | null; qty: number; price: number; variant?: string | null; variant_label?: string | null };
  type OrderRow = {
    pay_method: string | null;
    items: OrderItem[] | null;
    subtotal: number | null;
    shipping: number | null;
    discount_amount: number | null;
    total: number | null;
    coupon_code: string | null;
    email: string | null;
    user_id: string | null;
  };
  let bankAccounts: BankAccount[] = [];
  let bankNotes = '';
  let summary: OrderRow | null = null;
  if (order) {
    const { data: row } = await supabaseAdmin()
      .from('orders')
      .select('pay_method, items, subtotal, shipping, discount_amount, total, coupon_code, email, user_id')
      .eq('order_number', order)
      .maybeSingle();
    summary = (row as OrderRow | null) ?? null;
    if (summary?.pay_method === 'bank') {
      const settings = await getSiteSettings();
      bankAccounts = parseBankAccounts(settings.pay_bank_accounts);
      bankNotes = settings.pay_bank_instructions ?? '';
    }
  }
  const summaryItems = Array.isArray(summary?.items) ? summary!.items! : [];

  // The page's framing branches on whether we can reach the customer
  // ourselves. With an email on the order, the confirmation email (sent
  // instantly, and it predicts the staff WhatsApp message) is the primary
  // acknowledgment and the WhatsApp button is an optional speed-up — asking
  // them to message us too would be redundant (owner, 12 Aug). Without an
  // email, the customer-initiated WhatsApp message is the ONLY instant
  // channel, so it leads.
  const hasEmail = Boolean(summary?.email);

  // Fire the canonical client `purchase` exactly once per completed order, but
  // only when we actually resolved a real order (never on a direct/naked visit
  // or a missing order). Works for both COD and gateway returns since both land
  // here; the client component dedupes on the order number.
  const firePurchase = Boolean(order) && summary != null && summary.total != null;
  const purchaseItems = summaryItems.map((it) => ({
    product_id: it.id,
    slug: it.slug ?? undefined,
    product_name: it.name,
    brand: it.brand ?? undefined,
    category: it.category ?? undefined,
    variant: it.variant_label ?? it.variant ?? undefined,
    price: it.price,
    qty: it.qty,
    currency: 'PKR',
  }));

  return (
    <main className="fade-in">
      {firePurchase && (
        <ThankYouPurchase
          orderNumber={order!}
          value={summary!.total!}
          items={purchaseItems}
          coupon={summary!.coupon_code || undefined}
        />
      )}
      <section style={{ padding: 'var(--section-gap) 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 560 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Order Confirmed</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Thank you!</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 8 }}>
            Your order <strong>{orderNumber}</strong> has been placed successfully.
          </p>
          {hasEmail ? (
            <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 32 }}>
              We&apos;ve emailed your order confirmation. Our team will message you on WhatsApp to
              confirm your order before dispatch, and you&apos;ll get tracking on the same chat.
              Delivery typically takes {deliveryEstimate}.
            </p>
          ) : (
            <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 32 }}>
              One quick step left: tap the green button below to confirm your order on WhatsApp.
              It takes two seconds, works at any hour, and our team replies there with your dispatch
              and tracking updates. Delivery typically takes {deliveryEstimate}.
            </p>
          )}

          {bankAccounts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <BankAccountsList accounts={bankAccounts} notes={bankNotes} reference={orderNumber} />
            </div>
          )}

          {summaryItems.length > 0 && (
            <div style={{ background: 'var(--paper2)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 24, marginBottom: 24, textAlign: 'left' }}>
              <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>Order Summary</Overline>
              {summaryItems.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: '0.8125rem' }}>
                    {it.name}
                    {(it.variant_label ?? it.variant) ? <span className="small-text" style={{ marginLeft: 6 }}>{it.variant_label ?? it.variant}</span> : null}
                    <span className="small-text" style={{ marginLeft: 6 }}>× {it.qty}</span>
                  </span>
                  <span className="tabular-nums" style={{ fontSize: '0.8125rem', fontWeight: 500, flexShrink: 0 }}>PKR {(it.price * it.qty).toLocaleString()}</span>
                </div>
              ))}
              <hr className="hairline" style={{ margin: '14px 0' }} />
              {summary?.subtotal != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="small-text">Subtotal</span>
                  <span className="small-text tabular-nums">PKR {summary.subtotal.toLocaleString()}</span>
                </div>
              )}
              {(summary?.discount_amount ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="small-text" style={{ color: '#15803d' }}>Discount</span>
                  <span className="small-text tabular-nums" style={{ color: '#15803d' }}>− PKR {summary!.discount_amount!.toLocaleString()}</span>
                </div>
              )}
              {summary?.shipping != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="small-text">Shipping</span>
                  <span className="small-text tabular-nums" style={{ color: summary.shipping === 0 ? 'var(--success)' : 'inherit' }}>{summary.shipping === 0 ? 'FREE' : `PKR ${summary.shipping.toLocaleString()}`}</span>
                </div>
              )}
              {summary?.total != null && (
                <>
                  <hr className="hairline" style={{ margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Total</span>
                    <span className="tabular-nums" style={{ fontSize: '0.9375rem', fontWeight: 700 }}>PKR {summary.total.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ background: 'var(--paper2)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 24, marginBottom: 32, textAlign: 'left' }}>
            <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>What Happens Next</Overline>
            {(hasEmail
              ? [
                  { step: '1', label: 'Order received', desc: 'Your confirmation email is already in your inbox.' },
                  { step: '2', label: 'WhatsApp confirmation', desc: 'Our team messages you on WhatsApp to confirm before dispatch, then sends tracking on the same chat.' },
                  { step: '3', label: 'Delivered', desc: 'Pay on delivery (COD) or already paid.' },
                ]
              : [
                  { step: '1', label: 'Confirm on WhatsApp', desc: 'Tap the green button below. Your message reaches us instantly, any time of day, and secures your order.' },
                  { step: '2', label: 'Preparing & shipped', desc: 'Our team replies on the same chat, packs your order and sends your tracking number there.' },
                  { step: '3', label: 'Delivered', desc: 'Pay on delivery (COD) or already paid.' },
                ]
            ).map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: i < 2 ? 16 : 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--brand-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{s.step}</div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                  <div className="small-text">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp CTA. With an email on the order it's an optional
              speed-up (the email is the acknowledgment); without one, the
              customer's own message is the only instant channel, so it's
              the headline action. Pre-types the order number. Hides if
              NEXT_PUBLIC_WHATSAPP_NUMBER unset. */}
          <div style={{ marginBottom: 24 }}>
            {hasEmail && (
              <p className="small-text" style={{ color: 'var(--ink-500)', marginBottom: 8 }}>
                In a hurry? You can also confirm right away, no need to wait for our message:
              </p>
            )}
            <WhatsAppButton
              message={WA_TEMPLATES.orderConfirm(orderNumber)}
              label={hasEmail ? 'Confirm now on WhatsApp' : 'Confirm your order on WhatsApp'}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            <Link href="/shop" className="btn-primary">Continue Shopping</Link>
            <Link href="/" className="btn-secondary">Back to Home</Link>
          </div>

          {/* Post-purchase account offer (industry-standard "save your info
              for next time" moment). Server-side gate: only for orders that
              were genuinely placed as guest (no user_id) and carry an email.
              The client component additionally hides itself if a session is
              present in the browser. */}
          {summary && !summary.user_id && summary.email && (
            <ThankYouAccountOffer email={summary.email} />
          )}

          {/* Post-purchase opt-in, soft ask after a successful order. The
              checkout itself doesn't ship the email to the newsletter list
              (consent must be explicit), this is the explicit moment. */}
          <div
            style={{
              padding: 20,
              background: 'var(--paper2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              textAlign: 'left',
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--brand-pink-text)' }}>
              Stay in the loop
            </Overline>
            <p className="small-text" style={{ marginBottom: 12, color: 'var(--ink-700)' }}>
              Get a fortnightly note on new drops, restocks, and routine tips. Unsubscribe any time.
            </p>
            <NewsletterSignup source="post_purchase" variant="light" ctaLabel="Sign up" />
          </div>
        </div>
      </section>
    </main>
  );
}
