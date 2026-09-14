// Customer-facing order confirmation, reached from the link in the order email.
//
// Deliberately a PAGE with a button rather than a link that confirms on GET.
// Inbox scanners, link-preview bots and "safe links" proxies fetch every URL in
// an email before the human sees it, so a mutating GET would mark orders
// confirmed that nobody opened — which is worse than the problem it solves,
// because staff would then dispatch on a confirmation that never happened.
// The button POSTs through a server action.

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { verifyOrderConfirmToken } from '@/lib/order-confirm-token';
import { ConfirmPanel } from './ConfirmPanel';

export const metadata: Metadata = pageMeta({
  title: 'Confirm your order',
  description: 'Confirm your Yellow Pink order so we can dispatch it.',
  path: '/order/confirm',
  noIndex: true,
});

type SearchParams = Promise<{ o?: string; t?: string }>;

export default async function OrderConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  const { o, t } = await searchParams;
  const orderNumber = o?.trim().toUpperCase() ?? '';
  const token = t?.trim() ?? '';
  const valid = Boolean(orderNumber && token && verifyOrderConfirmToken(orderNumber, token));

  if (!valid) {
    return (
      <Center>
        <h1 className="display-l" style={{ fontSize: '2rem', margin: '0 0 12px' }}>
          This confirmation link is not valid
        </h1>
        <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 24px' }}>
          It may have been copied incompletely from the email. You can still confirm by
          messaging us on WhatsApp with your order number, and we will dispatch straight away.
        </p>
        <a href="/go/whatsapp?src=confirm-invalid" className="btn-primary" style={{ textDecoration: 'none' }}>
          Confirm on WhatsApp
        </a>
      </Center>
    );
  }

  return (
    <Center>
      <ConfirmPanel orderNumber={orderNumber} token={token} />
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <section style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 520 }}>
          {children}
        </div>
      </section>
    </main>
  );
}
