'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogoWordmark } from '@/components/ui/LogoWordmark';
import { useCart } from '@/context/CartContext';
import { useSearch } from '@/context/SearchContext';
import { useAuth } from '@/context/AuthContext';
import { useEscapeKey } from '@/lib/hooks/useBodyScrollLock';

const NAV_ITEMS = [
  { label: 'Makeup',   href: '/shop?category=Makeup' },
  { label: 'Skincare', href: '/shop?category=Skincare' },
  { label: 'Wellness', href: '/shop?category=Wellness' },
  { label: 'Shop',     href: '/shop' },
  { label: 'Blog',     href: '/blog' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  useEscapeKey(mobileMenu, () => setMobileMenu(false));
  const { cartCount, setCartOpen } = useCart();
  const { setSearchOpen } = useSearch();
  const { user } = useAuth();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--paper)',
      borderBottom: '1px solid var(--line)',
      transition: 'padding 200ms ease-out',
      padding: scrolled ? '8px 0' : '14px 0',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <LogoWordmark />
        </Link>

        <nav style={{ display: 'flex', gap: 32, alignItems: 'center' }} className="desktop-nav">
          {NAV_ITEMS.map(item => (
            <Link key={item.label} href={item.href} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 500,
              color: 'var(--ink-700)', letterSpacing: '0.02em',
              padding: '4px 0', textDecoration: 'none',
              transition: 'color 150ms',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-900)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-700)')}
            >{item.label}</Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button onClick={() => setSearchOpen(true)} aria-label="Search products" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-700)', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <Link href={user ? '/account' : '/login'} aria-label={user ? 'My account' : 'Sign in'} style={{ color: 'var(--ink-700)', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
          <button onClick={() => setCartOpen(true)} aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-900)',
            display: 'flex', alignItems: 'center', gap: 4, position: 'relative',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {cartCount > 0 && (
              <span aria-hidden="true" style={{
                position: 'absolute', top: -6, right: -8,
                background: 'var(--brand-pink)', color: '#fff',
                width: 16, height: 16, borderRadius: '50%',
                fontSize: '0.625rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{cartCount}</span>
            )}
          </button>
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label={mobileMenu ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenu}
            aria-controls="mobile-nav"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-900)', display: 'none' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileMenu
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>
              }
            </svg>
          </button>
        </div>
      </div>

      {mobileMenu && (
        <nav
          id="mobile-nav"
          aria-label="Mobile menu"
          style={{ padding: '16px var(--side)', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {NAV_ITEMS.map(item => (
            <Link key={item.label} href={item.href}
              onClick={() => setMobileMenu(false)}
              style={{
                textDecoration: 'none', fontFamily: 'var(--font-ui)',
                fontSize: '0.9375rem', fontWeight: 500, color: 'var(--ink-900)',
              }}
            >{item.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
