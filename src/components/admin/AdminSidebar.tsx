'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAdmin } from '@/app/admin/actions';

const nav = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '▣' },
  { href: '/admin/products', label: 'Products', icon: '◈' },
  { href: '/admin/orders', label: 'Orders', icon: '◎' },
  { href: '/admin/blog', label: 'Blog', icon: '✦' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 240,
      background: '#111827',
      minHeight: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }}>
      {/* Brand */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1f2937' }}>
        <div style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
          <span style={{ color: '#f9a8d4' }}>Yellow</span>
          <span style={{ color: '#ffffff' }}>Pink</span>
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.6875rem', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Admin Panel
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              color: active ? '#f9fafb' : '#9ca3af',
              background: active ? 'rgba(249,168,212,0.1)' : 'transparent',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: active ? 600 : 400,
              borderLeft: `3px solid ${active ? '#f472b6' : 'transparent'}`,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: '1rem', opacity: active ? 1 : 0.6 }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #1f2937' }}>
        <form action={logoutAdmin}>
          <button type="submit" style={{
            width: '100%',
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid #374151',
            borderRadius: 6,
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s',
          }}>
            <span>↩</span> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
