import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup';

const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '923001234567';

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const orderNumber = order ?? 'YP-??????';

  const waText = encodeURIComponent(
    `Hi Yellow Pink! I just placed order ${orderNumber} and would like to confirm my details.`
  );
  const waLink = `https://wa.me/${WA_NUMBER}?text=${waText}`;

  return (
    <main className="fade-in">
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
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 32 }}>
            We&apos;ll send you a confirmation on WhatsApp with tracking details once your order ships. Delivery typically takes 2–4 business days.
          </p>

          <div style={{ background: 'var(--paper2)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 24, marginBottom: 32, textAlign: 'left' }}>
            <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>What Happens Next</Overline>
            {[
              { step: '1', label: 'Order Processing', desc: "We're packing your items with care." },
              { step: '2', label: 'Shipped', desc: "You'll receive tracking via WhatsApp." },
              { step: '3', label: 'Delivered', desc: 'Pay on delivery (COD) or already paid.' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: i < 2 ? 16 : 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--brand-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{s.step}</div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                  <div className="small-text">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp CTA */}
          <div style={{ marginBottom: 24 }}>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: '#25D366', color: '#fff', textDecoration: 'none',
                padding: '12px 24px', borderRadius: 'var(--radius-pill)',
                fontWeight: 700, fontSize: '0.9375rem',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Chat on WhatsApp
            </a>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            <Link href="/shop" className="btn-primary">Continue Shopping</Link>
            <Link href="/" className="btn-secondary">Back to Home</Link>
          </div>

          {/* Post-purchase opt-in — soft ask after a successful order. The
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
            <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--brand-pink)' }}>
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
