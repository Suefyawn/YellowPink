'use client';

import Link from 'next/link';
import { LogoMark } from '@/components/ui/LogoMark';
import { LogoWordmark } from '@/components/ui/LogoWordmark';
import { Overline } from '@/components/ui/Overline';

// Footer link list rendered with a consistent "overline-ish" treatment —
// slightly tighter letter-spacing and weight than body text, so each
// column reads as a navigable group rather than a paragraph.
function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li style={{ marginBottom: 10, listStyle: 'none' }}>
      <Link
        href={href}
        style={{
          color: 'rgba(250,246,238,0.7)',
          textDecoration: 'none',
          fontFamily: 'var(--font-ui)',
          fontSize: '0.8125rem',
          fontWeight: 500,
          letterSpacing: '0.01em',
          transition: 'color 150ms',
          display: 'inline-block',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--paper)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(250,246,238,0.7)')}
      >
        {label}
      </Link>
    </li>
  );
}

const SHOP_LINKS = [
  { label: 'Makeup',       href: '/shop?category=Makeup' },
  { label: 'Skincare',     href: '/shop?category=Skincare' },
  { label: 'Wellness',     href: '/shop?category=Wellness' },
  { label: 'All Products', href: '/shop' },
];

const COMPANY_LINKS = [
  { label: 'About Us',         href: '/page/about' },
  { label: 'Blog',             href: '/blog' },
  { label: 'Contact',          href: '/page/contact' },
  { label: 'Shipping Policy',  href: '/page/shipping' },
];

const HELP_LINKS = [
  { label: 'Track Order',  href: '/track' },
  { label: 'My Account',   href: '/account' },
  { label: 'Returns',      href: '/page/returns' },
  { label: 'FAQ',          href: '/page/faq' },
];

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://instagram.com/yellowpinkpk' },
  { label: 'TikTok',    href: 'https://tiktok.com/@yellowpinkpk' },
  { label: 'Facebook',  href: 'https://facebook.com/yellowpinkpk' },
];

export function Footer() {
  return (
    <footer
      role="contentinfo"
      aria-label="Site footer"
      style={{ background: 'var(--ink-900)', color: 'var(--paper)', padding: '64px 0 32px', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', bottom: 20, right: 30, opacity: 0.04 }}>
        <LogoMark size={200} />
      </div>
      <div className="container">
        {/* Marquee — paused on hover + when prefers-reduced-motion is set
            (see .footer-marquee in globals.css). aria-hidden so screen
            readers don't read the scrolling text. */}
        <div
          aria-hidden="true"
          style={{ borderBottom: '1px solid rgba(250,246,238,0.1)', paddingBottom: 32, marginBottom: 40, overflow: 'hidden', whiteSpace: 'nowrap' }}
        >
          <div
            className="footer-marquee"
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontStyle: 'italic',
              color: 'rgba(250,246,238,0.2)',
            }}
          >
            {Array(6).fill('Yellow Pink Store Pakistan · ').join('')}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40 }}>
          <div>
            <div style={{ marginBottom: 24 }}><LogoWordmark color="var(--paper)" /></div>
            <p className="small-text" style={{ color: 'rgba(250,246,238,0.55)', maxWidth: 260, marginBottom: 16 }}>
              Quality ingredients. Real results. Imported beauty & wellness delivered across Pakistan.
            </p>
            <address style={{ fontStyle: 'normal' }}>
              <p className="small-text" style={{ color: 'rgba(250,246,238,0.5)', fontSize: '0.75rem' }}>
                Karachi · Lahore · Islamabad<br />
                Cash on Delivery available
              </p>
            </address>
          </div>

          <nav aria-label="Shop">
            <Overline style={{ color: 'rgba(250,246,238,0.4)', display: 'block', marginBottom: 16 }}>Shop</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {SHOP_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <nav aria-label="Company">
            <Overline style={{ color: 'rgba(250,246,238,0.4)', display: 'block', marginBottom: 16 }}>Company</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {COMPANY_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <nav aria-label="Help">
            <Overline style={{ color: 'rgba(250,246,238,0.4)', display: 'block', marginBottom: 16 }}>Help</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {HELP_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <div>
            <Overline style={{ color: 'rgba(250,246,238,0.4)', display: 'block', marginBottom: 16 }}>Newsletter</Overline>
            <p className="small-text" style={{ color: 'rgba(250,246,238,0.55)', marginBottom: 12 }}>Sign up for health tips & exclusive offers.</p>
            <form
              action="/api/newsletter"
              method="post"
              style={{ display: 'flex', gap: 0 }}
              aria-label="Newsletter signup"
            >
              <label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
              <input
                id="footer-newsletter-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="your@email.com"
                style={{
                  flex: 1, padding: '10px 12px', background: 'rgba(250,246,238,0.08)',
                  border: '1px solid rgba(250,246,238,0.15)', borderRight: 'none',
                  borderRadius: '3px 0 0 3px', color: 'var(--paper)', fontSize: '0.8125rem',
                  outline: 'none', fontFamily: 'var(--font-ui)',
                }}
              />
              <button
                type="submit"
                aria-label="Subscribe to newsletter"
                style={{
                  padding: '10px 16px', background: 'var(--brand-pink)', border: 'none',
                  borderRadius: '0 3px 3px 0', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                  letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font-ui)', textTransform: 'uppercase',
                }}
              >Join</button>
            </form>
          </div>
        </div>

        <div style={{
          marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(250,246,238,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <span className="small-text" style={{ color: 'rgba(250,246,238,0.3)' }}>© {new Date().getFullYear()} Yellow Pink. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 20 }} aria-label="Social media">
            {SOCIAL_LINKS.map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Yellow Pink on ${s.label}`}
                style={{
                  color: 'rgba(250,246,238,0.4)',
                  textDecoration: 'none',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-ui)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--paper)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(250,246,238,0.4)')}
              >{s.label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
