'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { LogoWordmark } from '@/components/ui/LogoWordmark';
import { useCart } from '@/context/CartContext';
import { useSearch } from '@/context/SearchContext';
import { useAuth } from '@/context/AuthContext';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
import { TAXONS, categoryHref, type Taxon } from '@/lib/category-taxonomy';

// Desktop nav: each taxon (Makeup / Skincare / Wellness / Bundles) opens a
// mega-menu dropdown of its categories; the flat items are plain links.
// Driven by the central taxonomy so editorial changes don't touch the header.
//
// `primary` items show as their own links in the (space-constrained) desktop
// top bar — only Sale, alongside the four taxons, so the row stays sleek. The
// non-primary destinations are gathered into the desktop "Discover" dropdown
// (see below) rather than each taking a row slot (a 9-item row read as
// cluttered), and they all still appear in the mobile drawer and the footer.
const FLAT_ITEMS = [
  { label: 'Collections', href: '/collections', primary: false },
  { label: 'Brands', href: '/brands', primary: false },
  { label: 'K-Beauty', href: '/k-beauty', primary: false },
  { label: 'Find Your Match', href: '/quiz', primary: false },
  { label: 'Quick Answers', href: '/answers', primary: false },
  { label: 'Sale', href: '/deals', primary: true },
  { label: 'Blog', href: '/blog', primary: false },
];

function navLinkStyle(active: boolean): React.CSSProperties {
  return {
    // `inline-block` so the 4px vertical padding counts toward the box,     // taxon links are wrapped in a div, flat links aren't, and as plain
    // inline anchors that padding was ignored only for the wrapped ones,
    // leaving Sale/Blog sitting higher than the rest.
    display: 'inline-block',
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-ui)', fontSize: '0.8125rem',
    fontWeight: active ? 600 : 500,
    color: active ? 'var(--ink-900)' : 'var(--ink-700)',
    letterSpacing: '0.02em', padding: '4px 0', textDecoration: 'none',
    borderBottom: active ? '2px solid var(--brand-pink)' : '2px solid transparent',
    transition: 'color 150ms', whiteSpace: 'nowrap',
  };
}

interface HeaderShellProps {
  /** `${pathname}?${searchParams}`, changes on every navigation, used only to
   *  reset transient UI (open menus/drawer) when the route changes. Passed
   *  in rather than read directly with usePathname/useSearchParams so this
   *  component has zero dependency on the router's search-params hook, see
   *  HeaderFallback for why that matters. */
  navKey: string;
  isActiveLink: (href: string) => boolean;
  isTaxonActive: (taxon: Taxon) => boolean;
  isCategoryActive: (cat: string) => boolean;
}

/** All of the header's markup and self-contained UI state (scroll shadow,
 *  mobile drawer, mega-menu open state, cart badge hydration gate). Takes the
 *  route-derived "what's active" answers as props instead of calling
 *  usePathname/useSearchParams itself, so the exact same component can render
 *  as both the real (search-params-aware) header and a static, hook-free
 *  fallback with identical layout, see HeaderFallback.tsx. */
export function HeaderShell({ navKey, isActiveLink, isTaxonActive, isCategoryActive }: HeaderShellProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  // Hydration gate for the cart-count badge. The cart loads from
  // localStorage in CartProvider's mount effect; reading cartCount directly
  // would render "2 items" on the client while the server rendered "0",
  // tripping a hydration mismatch. Gating on this component's own mount
  // state keeps the first client render identical to the server, then
  // updates.
  const [mounted, setMounted] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);       // desktop mega-menu
  const [openSection, setOpenSection] = useState<string | null>(null); // mobile expandable section
  const drawerRef = useRef<HTMLDivElement | null>(null);
  // Mobile-menu modal behaviour: lock body scroll, trap focus inside the
  // drawer, close on Escape. Without scroll-lock the page underneath
  // would keep scrolling behind the open menu, a confusing UX.
  useBodyScrollLock(mobileMenu);
  useEscapeKey(mobileMenu, () => setMobileMenu(false));
  useFocusTrap(mobileMenu, drawerRef);
  const { cartCount, setCartOpen } = useCart();
  const { setSearchOpen } = useSearch();
  const { user } = useAuth();

  // Close any open menu when navigation completes. On a client-side route change
  // the header persists, and a hover-opened desktop mega-menu (or the mobile
  // drawer / expanded section) would otherwise linger open over the freshly
  // loaded page, clicking a dropdown link should land you on the new page with
  // the menu closed, the industry-standard behaviour.
  useEffect(() => {
    // Closing menus in response to an external change (the URL) is exactly what
    // an effect is for here; the lint rule's cascading-render concern doesn't
    // apply to a one-shot reset on navigation.
    /* eslint-disable react-hooks/set-state-in-effect */
    setOpenMenu(null);
    setOpenSection(null);
    setMobileMenu(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [navKey]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Suppress the cart count until mounted, see the `mounted` state above.
  const cartBadgeCount = mounted ? cartCount : 0;

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

        <nav style={{ display: 'flex', gap: 26, alignItems: 'center' }} className="desktop-nav" aria-label="Primary">
          {TAXONS.map(t => {
            const active = isTaxonActive(t);
            const open = openMenu === t.key;
            return (
              <div
                key={t.key}
                style={{ position: 'relative' }}
                onMouseEnter={() => setOpenMenu(t.key)}
                onMouseLeave={() => setOpenMenu(null)}
                onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpenMenu(null); }}
                onKeyDown={e => { if (e.key === 'Escape') setOpenMenu(null); }}
              >
                <Link
                  href={`/shop?taxon=${t.key}`}
                  aria-current={active ? 'page' : undefined}
                  aria-expanded={open}
                  onFocus={() => setOpenMenu(t.key)}
                  style={navLinkStyle(active)}
                >{t.label}</Link>
                {open && (
                  // Outer wrapper sits flush against the link (top:100%) and
                  // its transparent paddingTop bridges the visual gap, so the
                  // cursor never crosses a dead zone that would fire mouseleave
                  // and close the menu before a dropdown item can be clicked.
                  <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: 10, zIndex: 200 }}>
                    <div
                      style={{
                        minWidth: 220, padding: 8,
                        background: 'var(--paper)', border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-card)', boxShadow: '0 14px 36px rgba(0,0,0,0.13)',
                      }}
                    >
                      <Link
                        href={`/shop?taxon=${t.key}`}
                        style={{
                          display: 'block', padding: '8px 12px', textDecoration: 'none',
                          fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 700,
                          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-pink-text)',
                        }}
                      >All {t.label}</Link>
                      {t.categories.map(cat => (
                        <Link
                          key={cat}
                          href={categoryHref(cat)}
                          style={{
                            display: 'block', padding: '9px 12px', borderRadius: 8,
                            textDecoration: 'none', fontFamily: 'var(--font-ui)',
                            fontSize: '0.875rem', color: 'var(--ink-700)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper2)'; e.currentTarget.style.color = 'var(--ink-900)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-700)'; }}
                        >{cat}</Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {FLAT_ITEMS.filter(item => item.primary).map(item => {
            const active = isActiveLink(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={navLinkStyle(active)}
              >{item.label}</Link>
            );
          })}
          {/* "Discover" gathers the non-primary destinations (Collections /
              Brands / K-Beauty / quiz / Blog) into ONE dropdown, so they're
              reachable on desktop (2026-07 audit: they only existed in the
              mobile drawer + footer) without re-cluttering the top row —
              same mega-menu pattern and hover-bridge as the taxon items. */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setOpenMenu('discover')}
            onMouseLeave={() => setOpenMenu(null)}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpenMenu(null); }}
            onKeyDown={e => { if (e.key === 'Escape') setOpenMenu(null); }}
          >
            <button
              type="button"
              aria-expanded={openMenu === 'discover'}
              aria-haspopup="true"
              onFocus={() => setOpenMenu('discover')}
              onClick={() => setOpenMenu(openMenu === 'discover' ? null : 'discover')}
              style={{ ...navLinkStyle(FLAT_ITEMS.some(i => !i.primary && isActiveLink(i.href))), display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              Discover
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {openMenu === 'discover' && (
              <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 10, zIndex: 200 }}>
                <div style={{
                  minWidth: 200, padding: 8,
                  background: 'var(--paper)', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-card)', boxShadow: '0 14px 36px rgba(0,0,0,0.13)',
                }}>
                  {FLAT_ITEMS.filter(item => !item.primary).map(item => (
                    <Link
                      key={item.label}
                      href={item.href}
                      aria-current={isActiveLink(item.href) ? 'page' : undefined}
                      style={{
                        display: 'block', padding: '9px 12px', borderRadius: 8,
                        textDecoration: 'none', fontFamily: 'var(--font-ui)',
                        fontSize: '0.875rem', color: 'var(--ink-700)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper2)'; e.currentTarget.style.color = 'var(--ink-900)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-700)'; }}
                    >{item.label}</Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Each header icon button gets a 40x40 hit area (10px padding around
              an 18-20px glyph) so it satisfies WCAG 2.5.5 / 2.5.8 minimum tap
              target without changing the visual look, the SVG still appears
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
            href={user ? '/account' : '/login'}            aria-label={user ? 'My account' : 'Sign in'}
            className="header-icon-desktop-only"
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
          <Link
            href="/wishlist"            aria-label="My wishlist"
            title="Wishlist"
            className="header-icon-desktop-only"
            style={{
              color: 'var(--ink-700)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 8,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </Link>
          <button onClick={() => setCartOpen(true)} aria-label={`Open cart, ${cartBadgeCount} item${cartBadgeCount === 1 ? '' : 's'}`} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-900)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 8, padding: 0, position: 'relative',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {cartBadgeCount > 0 && (
              <span aria-hidden="true" style={{
                position: 'absolute', top: -6, right: -8,
                background: 'var(--brand-pink-cta)', color: '#fff',
                width: 16, height: 16, borderRadius: '50%',
                fontSize: '0.625rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{cartBadgeCount}</span>
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
          / sticky-header heights, those vary per page and per scroll
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
          // dvh, not vh: on mobile browsers 100vh includes the area behind the
          // collapsing URL bar, so the drawer's bottom links could sit under
          // the browser chrome and be unreachable. dvh tracks the real
          // visible viewport.
          maxHeight: '100dvh', minHeight: 240,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Sheet header, logo + close button. Mirrors the storefront
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
            aria-label="Yellow Pink, home"
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
          {TAXONS.map(t => {
            const expanded = openSection === t.key;
            const taxonActive = isTaxonActive(t);
            return (
              <div key={t.key} style={{ borderBottom: '1px solid var(--line)' }}>
                <button
                  type="button"
                  onClick={() => setOpenSection(expanded ? null : t.key)}
                  aria-expanded={expanded}
                  aria-current={taxonActive ? 'page' : undefined}
                  aria-controls={`mobile-nav-${t.key}`}
                  tabIndex={mobileMenu ? 0 : -1}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '1.0625rem', fontWeight: taxonActive ? 700 : 600,
                    color: taxonActive ? 'var(--brand-pink-text)' : 'var(--ink-900)', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '18px 4px', minHeight: 52,
                  }}
                >
                  {t.label}
                  <span aria-hidden="true" style={{
                    fontSize: '1.25rem', color: 'var(--ink-500)',
                    transform: expanded ? 'rotate(45deg)' : 'rotate(0)',
                    transition: 'transform 180ms ease-out', lineHeight: 1,
                  }}>+</span>
                </button>
                {expanded && (
                  <div id={`mobile-nav-${t.key}`} style={{ paddingBottom: 10 }}>
                    <Link
                      href={`/shop?taxon=${t.key}`}
                      onClick={() => setMobileMenu(false)}
                      tabIndex={mobileMenu ? 0 : -1}
                      style={{
                        display: 'block', padding: '10px 16px', textDecoration: 'none',
                        fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--brand-pink-text)',
                      }}
                    >All {t.label}</Link>
                    {t.categories.map(cat => {
                      const catActive = isCategoryActive(cat);
                      return (
                        <Link
                          key={cat}
                          href={categoryHref(cat)}
                          onClick={() => setMobileMenu(false)}
                          aria-current={catActive ? 'page' : undefined}
                          tabIndex={mobileMenu ? 0 : -1}
                          style={{
                            display: 'block', padding: '11px 16px', textDecoration: 'none',
                            fontFamily: 'var(--font-ui)', fontSize: '0.9375rem',
                            fontWeight: catActive ? 700 : 400,
                            color: catActive ? 'var(--brand-pink-text)' : 'var(--ink-700)',
                          }}
                        >{cat}</Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {FLAT_ITEMS.map(item => {
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
                  borderBottom: '1px solid var(--line)',
                }}
              >{item.label}</Link>
            );
          })}
          {/* Account shortcut card, saves the user from dismissing the
              menu + hitting the tiny header icon. */}
          <Link
            href={user ? '/account' : '/login'}            onClick={() => setMobileMenu(false)}
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
          {/* Wishlist, moved off the cramped header icon row into the drawer. */}
          <Link
            href="/wishlist"            onClick={() => setMobileMenu(false)}
            tabIndex={mobileMenu ? 0 : -1}
            style={{
              marginTop: 10, padding: '16px 18px',
              background: 'var(--paper2)', borderRadius: 'var(--radius-card)',
              textDecoration: 'none', color: 'var(--ink-900)',
              fontFamily: 'var(--font-ui)', fontSize: '0.9375rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 52,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            My wishlist
          </Link>
        </nav>
      </div>
    </header>
  );
}
