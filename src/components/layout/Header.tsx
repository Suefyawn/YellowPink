'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LogoWordmark } from '@/components/ui/LogoWordmark';
import { useCart } from '@/context/CartContext';
import { useSearch } from '@/context/SearchContext';
import { useAuth } from '@/context/AuthContext';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';

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
  const drawerRef = useRef<HTMLDivElement | null>(null);
  // Mobile-menu modal behaviour: lock body scroll, trap focus inside the
  // drawer, close on Escape. Without scroll-lock the page underneath
  // would keep scrolling behind the open menu — a confusing UX.
  useBodyScrollLock(mobileMenu);
  useEscapeKey(mobileMenu, () => setMobileMenu(false));
  useFocusTrap(mobileMenu, drawerRef);
  const { cartCount, setCartOpen } = useCart();
  const { setSearchOpen } = useSearch();
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Decide which NAV_ITEM is "active" for the current URL. We match on
  // pathname + category query so /shop?category=Makeup highlights "Makeup",
  // but plain /shop highlights "Shop", and any /blog/* highlights "Blog".
  function isActiveLink(href: string): boolean {
    const [hPath, hQuery] = href.split('?');
    if (hPath !== pathname && !(hPath === '/blog' && pathname.startsWith('/blog/'))) return false;
    if (!hQuery) {
      // /shop active only when no category — otherwise the category items match.
      if (hPath === '/shop') return !searchParams.get('category');
      return true;
    }
    const wantCat = new URLSearchParams(hQuery).get('category');
    return searchParams.get('category') === wantCat;
  }

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Close the mobile menu whenever the route changes — otherwise a tap on a
  // nav item navigates but leaves the menu open underneath the new page.
  // The setState is intentional: pathname is from the routing system (an
  // external store), and the desired effect is to reset internal UI state
  // when the URL changes — there's no prop-derived equivalent.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenu(false);
  }, [pathname, searchParams]);

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: scrolled ? 'rgba(250, 246, 238, 0.86)' : 'var(--paper)',
      backdropFilter: scrolled ? 'saturate(140%) blur(10px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'saturate(140%) blur(10px)' : 'none',
      borderBottom: '1px solid ' + (scrolled ? 'rgba(26,26,26,0.08)' : 'var(--line)'),
      boxShadow: scrolled ? '0 6px 18px rgba(0,0,0,0.04)' : 'none',
      transition: 'padding 200ms ease-out, background 200ms ease-out, box-shadow 200ms ease-out',
      padding: scrolled ? '8px 0' : '14px 0',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <LogoWordmark />
        </Link>

        <nav style={{ display: 'flex', gap: 32, alignItems: 'center' }} className="desktop-nav" aria-label="Primary">
          {NAV_ITEMS.map(item => {
            const active = isActiveLink(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '0.8125rem',
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--ink-900)' : 'var(--ink-700)',
                  letterSpacing: '0.02em',
                  padding: '4px 0', textDecoration: 'none',
                  // Subtle pink underline on the active item — keeps the rest
                  // of the nav uncluttered while making the current page legible.
                  borderBottom: active ? '2px solid var(--brand-pink)' : '2px solid transparent',
                  transition: 'color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-900)')}
                onMouseLeave={e => (e.currentTarget.style.color = active ? 'var(--ink-900)' : 'var(--ink-700)')}
              >{item.label}</Link>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Each header icon button gets a 40x40 hit area (10px padding around
              an 18-20px glyph) so it satisfies WCAG 2.5.5 / 2.5.8 minimum tap
              target without changing the visual look — the SVG still appears
              the same size, but the clickable surface is much larger. */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search products"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-700)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 8, padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <Link
            href={user ? '/account' : '/login'}
            aria-label={user ? 'My account' : 'Sign in'}
            style={{
              color: 'var(--ink-700)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 8,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
          <button onClick={() => setCartOpen(true)} aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-900)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 8, padding: 0, position: 'relative',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {cartCount > 0 && (
              <span aria-hidden="true" style={{
                position: 'absolute', top: -6, right: -8,
                background: 'var(--brand-pink-cta)', color: '#fff',
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
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-900)',
              alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 8, padding: 0,
              display: 'none',
            }}
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

      {/* Mobile-menu sheet: covers the full viewport when open. We use a
          full-screen sheet instead of a header-anchored dropdown so we
          don't have to coordinate with the announcement bar / promo banner
          / sticky-header heights — those vary per page and per scroll
          position. The sheet has its own close button so the user always
          knows how to dismiss it. */}
      <div
        onClick={() => setMobileMenu(false)}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.55)',
          opacity: mobileMenu ? 1 : 0,
          pointerEvents: mobileMenu ? 'auto' : 'none',
          transition: 'opacity 200ms ease-out',
          zIndex: 950,
        }}
      />
      <div
        ref={drawerRef}
        id="mobile-nav"
        role={mobileMenu ? 'dialog' : undefined}
        aria-modal={mobileMenu ? 'true' : undefined}
        aria-label="Mobile menu"
        aria-hidden={!mobileMenu}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: 'var(--paper)',
          // Slide-down from the top with a fade. Translate well past the
          // viewport top so the slide is visible even on tall phones.
          transform: mobileMenu ? 'translateY(0)' : 'translateY(-105%)',
          opacity: mobileMenu ? 1 : 0,
          transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out',
          zIndex: 960, // above its own overlay; below toasts at z=9999
          maxHeight: '100vh', minHeight: 240,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Sheet header — logo + close button. Mirrors the storefront
            header so the user has a consistent reference frame when the
            sheet is open. */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px var(--side)', borderBottom: '1px solid var(--line)',
        }}>
          <Link
            href="/"
            onClick={() => setMobileMenu(false)}
            tabIndex={mobileMenu ? 0 : -1}
            aria-label="Yellow Pink — home"
            style={{ textDecoration: 'none', color: 'inherit', display: 'inline-flex' }}
          >
            <LogoWordmark />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
            tabIndex={mobileMenu ? 0 : -1}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-900)',
              width: 44, height: 44, borderRadius: 8, padding: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav aria-label="Mobile primary" style={{ padding: '8px var(--side) 24px', display: 'flex', flexDirection: 'column' }}>
          {NAV_ITEMS.map((item, i) => {
            const active = isActiveLink(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenu(false)}
                aria-current={active ? 'page' : undefined}
                tabIndex={mobileMenu ? 0 : -1}
                style={{
                  textDecoration: 'none', fontFamily: 'var(--font-ui)',
                  fontSize: '1.0625rem', fontWeight: active ? 700 : 500,
                  color: active ? 'var(--brand-pink)' : 'var(--ink-900)',
                  display: 'flex', alignItems: 'center',
                  padding: '18px 4px', minHeight: 52,
                  borderBottom: i < NAV_ITEMS.length - 1 ? '1px solid var(--line)' : 'none',
                }}
              >{item.label}</Link>
            );
          })}
          {/* Account shortcut card — saves the user from dismissing the
              menu + hitting the tiny header icon. */}
          <Link
            href={user ? '/account' : '/login'}
            onClick={() => setMobileMenu(false)}
            tabIndex={mobileMenu ? 0 : -1}
            style={{
              marginTop: 20, padding: '16px 18px',
              background: 'var(--paper2)', borderRadius: 'var(--radius-card)',
              textDecoration: 'none', color: 'var(--ink-900)',
              fontFamily: 'var(--font-ui)', fontSize: '0.9375rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 52,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            {user ? 'My account' : 'Sign in / Create account'}
          </Link>
        </nav>
      </div>
    </header>
  );
}
