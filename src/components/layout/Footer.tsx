'use client';

import Link from 'next/link';
import { LogoMark } from '@/components/ui/LogoMark';
import { LogoWordmark } from '@/components/ui/LogoWordmark';
import { Overline } from '@/components/ui/Overline';

export function Footer() {
  return (
    <footer style={{ background: 'var(--ink-900)', color: 'var(--paper)', padding: '64px 0 32px', position: 'relative', overflow: 'hidden' }}>
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
            <p className="small-text" style={{ color: 'rgba(250,246,238,0.5)', maxWidth: 260 }}>
              Quality ingredients. Real results. Imported beauty & wellness delivered across Pakistan.
            </p>
          </div>
          <div>
            <Overline style={{ color: 'rgba(250,246,238,0.4)', display: 'block', marginBottom: 16 }}>Shop</Overline>
            {[['Makeup', '/shop?category=Makeup'], ['Skincare', '/shop?category=Skincare'], ['Wellness', '/shop?category=Wellness'], ['All Products', '/shop']].map(([l, h]) => (
              <div key={l} style={{ marginBottom: 10 }}>
                <Link href={h} style={{ color: 'rgba(250,246,238,0.7)', textDecoration: 'none', fontSize: '0.875rem', transition: 'color 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--paper)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(250,246,238,0.7)')}
                >{l}</Link>
              </div>
            ))}
          </div>
          <div>
            <Overline style={{ color: 'rgba(250,246,238,0.4)', display: 'block', marginBottom: 16 }}>Company</Overline>
            {[['About Us', '#'], ['Blog', '/blog'], ['Contact', '#'], ['Shipping Policy', '#']].map(([l, h]) => (
              <div key={l} style={{ marginBottom: 10 }}>
                <Link href={h} style={{ color: 'rgba(250,246,238,0.7)', textDecoration: 'none', fontSize: '0.875rem' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--paper)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(250,246,238,0.7)')}
                >{l}</Link>
              </div>
            ))}
          </div>
          <div>
            <Overline style={{ color: 'rgba(250,246,238,0.4)', display: 'block', marginBottom: 16 }}>Newsletter</Overline>
            <p className="small-text" style={{ color: 'rgba(250,246,238,0.5)', marginBottom: 12 }}>Sign up for health tips & exclusive offers.</p>
            <div style={{ display: 'flex', gap: 0 }}>
              <input type="email" placeholder="your@email.com" style={{
                flex: 1, padding: '10px 12px', background: 'rgba(250,246,238,0.08)',
                border: '1px solid rgba(250,246,238,0.15)', borderRight: 'none',
                borderRadius: '3px 0 0 3px', color: 'var(--paper)', fontSize: '0.8125rem',
                outline: 'none', fontFamily: 'var(--font-ui)',
              }} />
              <button style={{
                padding: '10px 16px', background: 'var(--brand-pink)', border: 'none',
                borderRadius: '0 3px 3px 0', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font-ui)', textTransform: 'uppercase',
              }}>Join</button>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(250,246,238,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <span className="small-text" style={{ color: 'rgba(250,246,238,0.3)' }}>© 2026 Yellow Pink. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 16 }}>
            {['Instagram', 'TikTok', 'Facebook'].map(s => (
              <a key={s} href="#" style={{ color: 'rgba(250,246,238,0.4)', textDecoration: 'none', fontSize: '0.75rem' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--paper)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(250,246,238,0.4)')}
              >{s}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
