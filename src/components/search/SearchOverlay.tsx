'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { useSearch } from '@/context/SearchContext';
import { supabase } from '@/lib/supabase';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import type { Product } from '@/types';

const TRENDING = ['CeraVe', 'Rhode Lip Tint', 'Melasma Cream', 'NARS Foundation', 'Tarte Concealer'];
const POPULAR_CATS = ['Skincare', 'Lip Tints', 'Foundations', 'Sunscreen', 'Wellness'];

export function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useSearch();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useBodyScrollLock(searchOpen);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery(''); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [searchOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Server-side typeahead via search_products RPC (pg_trgm). Debounced 200 ms.
  useEffect(() => {
    if (!searchOpen || query.trim().length === 0) { setProducts([]); return; }
    const handle = setTimeout(() => {
      supabase.rpc('search_products' as never, { p_query: query, p_limit: 8 } as never).then(({ data }) => {
        setProducts((data ?? []) as Product[]);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query, searchOpen]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchOpen) setSearchOpen(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [searchOpen, setSearchOpen]);

  // Server already filtered + ranked via pg_trgm. Just rename for the JSX.
  const filtered = products;

  const goToProduct = (slug: string) => {
    setSearchOpen(false);
    router.push(`/product/${slug}`);
  };

  return (
    <>
      <div onClick={() => setSearchOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.5)',
        opacity: searchOpen ? 1 : 0, pointerEvents: searchOpen ? 'auto' : 'none',
        transition: 'opacity 200ms ease-out', zIndex: 300,
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: 'var(--paper)', zIndex: 301,
        transform: searchOpen ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 300ms ease-out',
        boxShadow: 'var(--shadow-1)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div className="container" style={{ padding: '24px var(--side)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: '2px solid var(--ink-900)', paddingBottom: 12, marginBottom: 24,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products, brands, concerns..."
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--font-ui)', fontSize: '1.125rem', fontWeight: 400,
                color: 'var(--ink-900)',
              }}
            />
            <button onClick={() => setSearchOpen(false)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-500)', fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'var(--font-ui)',
            }}>Close</button>
          </div>

          {query.length > 0 ? (
            <div>
              {filtered.length === 0 ? (
                <p className="body-text" style={{ color: 'var(--ink-500)', padding: '16px 0' }}>
                  No results for &ldquo;{query}&rdquo;. Try a different search term.
                </p>
              ) : (
                <div>
                  <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>
                    {filtered.length} Result{filtered.length !== 1 ? 's' : ''}
                  </Overline>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filtered.slice(0, 6).map((p) => (
                      <div key={p.id}
                        onClick={() => goToProduct(p.slug)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-card)', flexShrink: 0, overflow: 'hidden', background: 'var(--paper2)' }}>
                          <ProductImage src={p.image_url} alt={p.name} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Overline style={{ color: 'var(--ink-500)', fontSize: '0.5625rem', display: 'block' }}>{p.brand}</Overline>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.name}</div>
                        </div>
                        <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.875rem', flexShrink: 0 }}>
                          PKR {p.price.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }} className="search-suggestions">
              <div>
                <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Trending</Overline>
                {TRENDING.map((t) => (
                  <div key={t} onClick={() => setQuery(t)} style={{
                    padding: '8px 0', cursor: 'pointer', fontSize: '0.9375rem',
                    color: 'var(--ink-700)', borderBottom: '1px solid var(--line)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-900)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-700)')}
                  >{t}</div>
                ))}
              </div>
              <div>
                <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Categories</Overline>
                {POPULAR_CATS.map((c) => (
                  <div key={c} onClick={() => setQuery(c)} style={{
                    padding: '8px 0', cursor: 'pointer', fontSize: '0.9375rem',
                    color: 'var(--ink-700)', borderBottom: '1px solid var(--line)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-900)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-700)')}
                  >{c}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
