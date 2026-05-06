import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const orderNumber = order ?? 'YP-??????';

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

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/shop" className="btn-primary">Continue Shopping</Link>
            <Link href="/" className="btn-secondary">Back to Home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
