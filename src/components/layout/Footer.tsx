'use client';

import Link from 'next/link';
import { LogoMark } from '@/components/ui/LogoMark';
import { LogoWordmark } from '@/components/ui/LogoWordmark';
import { Overline } from '@/components/ui/Overline';
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup';
import type { SocialLink } from '@/lib/socials';

// Footer link list rendered with a consistent "overline-ish" treatment, // slightly tighter letter-spacing and weight than body text, so each
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
  // Taxon URLs match the post-076 nav: ?taxon=<key> expands to the
  // category set defined in lib/category-taxonomy.ts. `?category=Makeup`
  // and `?category=Wellness` return zero products because the real
  // category values are "Lip & Cheek Tints", "Human Health", etc.
  // Skincare keeps the taxon form for consistency (covers Moisturizers).
  { label: 'Makeup',       href: '/shop?taxon=makeup' },
  { label: 'Skincare',     href: '/shop?taxon=skincare' },
  { label: 'Wellness',     href: '/shop?taxon=wellness' },
  { label: 'K-Beauty',     href: '/k-beauty' },
  { label: 'Collections',  href: '/collections' },
  { label: 'All Brands',   href: '/brands' },
  { label: 'All Products', href: '/shop' },
];

const COMPANY_LINKS = [
  { label: 'About Us',           href: '/page/about' },
  { label: 'Blog',               href: '/blog' },
  { label: 'Editorial Standards', href: '/page/editorial-standards' },
  { label: 'Medical Review Board', href: '/medical-review-board' },
  { label: 'Contact',            href: '/page/contact' },
  { label: 'Shipping Policy',    href: '/page/shipping' },
];

const HELP_LINKS = [
  { label: 'Track Order',  href: '/track' },
  { label: 'My Account',   href: '/account' },
  { label: 'Returns',      href: '/page/returns' },
  { label: 'FAQ',          href: '/page/faq' },
  { label: 'Privacy',      href: '/privacy' },
  { label: 'Terms',        href: '/page/terms-and-conditions' },
  { label: 'Disclaimer',   href: '/page/disclaimer' },
  { label: 'Sitemap',      href: '/sitemap' },
];

// Brand glyphs keyed by platform. Instagram/Facebook/YouTube are lucide-style
// strokes; TikTok/X/Pinterest/WhatsApp are brand marks (fill) since an outline
// version isn't recognisable. All inherit colour via currentColor.
const SOCIAL_ICON: Record<string, React.ReactNode> = {
  social_instagram: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  ),
  social_facebook: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  social_youtube: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none" />
    </svg>
  ),
  social_tiktok: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.34-1.48z" />
    </svg>
  ),
  social_twitter: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  social_pinterest: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
    </svg>
  ),
  social_whatsapp: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884z" />
    </svg>
  ),
};

function SocialRow({ socials }: { socials: SocialLink[] }) {
  if (socials.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }} aria-label="Social media">
      {socials.map(s => (
        <a
          key={s.key}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Yellow Pink on ${s.label}`}
          title={s.label}
          className="footer-social"
          style={{
            color: 'rgba(250,246,238,0.72)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 10,
            border: '1px solid rgba(250,246,238,0.16)',
            transition: 'color 150ms, background 150ms, border-color 150ms',
          }}
        >
          {SOCIAL_ICON[s.key] ?? <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{s.label.charAt(0)}</span>}
        </a>
      ))}
    </div>
  );
}

interface FooterProps {
  socials?: SocialLink[];
  /** Published collections for the Collections column; column is omitted
   *  entirely when none are published (the static /collections link in the
   *  Shop column still covers discovery). */
  collections?: { slug: string; title: string }[];
}

export function Footer({ socials = [], collections = [] }: FooterProps) {
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
        {/* Marquee, paused on hover + when prefers-reduced-motion is set
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
              color: 'rgba(250,246,238,0.55)',
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
                Delivering nationwide across Pakistan<br />
                Cash on Delivery available
              </p>
            </address>
            <SocialRow socials={socials} />
          </div>

          <nav aria-label="Shop">
            <Overline style={{ color: 'rgba(250,246,238,0.6)', display: 'block', marginBottom: 16 }}>Shop</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {SHOP_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          {collections.length > 0 && (
            <nav aria-label="Collections">
              <Overline style={{ color: 'rgba(250,246,238,0.6)', display: 'block', marginBottom: 16 }}>Collections</Overline>
              <ul style={{ padding: 0, margin: 0 }}>
                {collections.map(c => <FooterLink key={c.slug} href={`/collection/${c.slug}`} label={c.title} />)}
                <FooterLink href="/collections" label="View all" />
              </ul>
            </nav>
          )}

          <nav aria-label="Company">
            <Overline style={{ color: 'rgba(250,246,238,0.6)', display: 'block', marginBottom: 16 }}>Company</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {COMPANY_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <nav aria-label="Help">
            <Overline style={{ color: 'rgba(250,246,238,0.6)', display: 'block', marginBottom: 16 }}>Help</Overline>
            <ul style={{ padding: 0, margin: 0 }}>
              {HELP_LINKS.map(l => <FooterLink key={l.label} {...l} />)}
            </ul>
          </nav>

          <div>
            <Overline style={{ color: 'rgba(250,246,238,0.6)', display: 'block', marginBottom: 16 }}>Newsletter</Overline>
            <p className="small-text" style={{ color: 'rgba(250,246,238,0.55)', marginBottom: 12 }}>Sign up for health tips & exclusive offers.</p>
            <NewsletterSignup source="footer" variant="dark" />
          </div>
        </div>

        <div style={{
          marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(250,246,238,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <span className="small-text" style={{ color: 'rgba(250,246,238,0.6)' }}>
            © {new Date().getFullYear()} Yellow Pink. Powered by{' '}
            <a
              href="https://trellee.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'rgba(250,246,238,0.85)', textDecoration: 'underline' }}
            >
              Trellee
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
