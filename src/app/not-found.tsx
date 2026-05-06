import Link from 'next/link';
import { LogoMark } from '@/components/ui/LogoMark';

export default function NotFound() {
  return (
    <main>
      <section style={{ padding: 'var(--section-gap) 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 560 }}>
          <div style={{ marginBottom: 24 }}>
            <LogoMark size={48} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '6rem', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 12, color: 'var(--ink-900)' }}>404</h1>
          <p className="h2" style={{ marginBottom: 12 }}>Page not found</p>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 32 }}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="btn-primary">Go Home</Link>
            <Link href="/shop" className="btn-secondary">Browse Shop</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
