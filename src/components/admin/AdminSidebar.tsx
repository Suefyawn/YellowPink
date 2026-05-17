'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAdmin } from '@/app/admin/actions';
import type { StaffSession, Permission } from '@/lib/permissions';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  permission?: Permission;
  ownerOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '▣', permission: 'analytics' },
  { href: '/admin/analytics', label: 'Analytics', icon: '◐', permission: 'analytics' },
  { href: '/admin/products',  label: 'Products',  icon: '◈', permission: 'products' },
  { href: '/admin/orders',    label: 'Orders',    icon: '◎', permission: 'orders' },
  { href: '/admin/users',     label: 'Customers', icon: '◉', permission: 'customers' },
  { href: '/admin/coupons',   label: 'Coupons',   icon: '◇', permission: 'coupons' },
  { href: '/admin/blog',      label: 'Blog',      icon: '✦', permission: 'blog' },
  { href: '/admin/reviews',   label: 'Reviews',   icon: '★', permission: 'products' },
  { href: '/admin/audit',     label: 'Audit log', icon: '◉', ownerOnly: true },
  { href: '/admin/team',      label: 'Team',      icon: '⬡', ownerOnly: true },
  { href: '/admin/settings',  label: 'Settings',  icon: '⚙', ownerOnly: true },
];

function canSee(item: NavItem, session: StaffSession): boolean {
  if (item.ownerOnly) return session.isOwner;
  if (!item.permission) return true;
  return session.isOwner || session.permissions.includes(item.permission);
}

export function AdminSidebar({ session, onClose, pendingOrderCount = 0 }: { session: StaffSession; onClose?: () => void; pendingOrderCount?: number }) {
  const pathname = usePathname();
  const visibleNav = NAV.filter(item => canSee(item, session));

  return (
    <aside style={{
      width: 240, background: '#111827', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Brand */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
            <span style={{ color: '#f9a8d4' }}>Yellow</span>
            <span style={{ color: '#ffffff' }}>Pink</span>
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.6875rem', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Admin Panel
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.25rem', padding: 4, lineHeight: 1 }}>✕</button>
        )}
      </div>

      {/* User badge */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: session.isOwner ? '#ec4899' : '#6366f1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0,
        }}>
          {session.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ color: '#f9fafb', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {session.name}
          </div>
          <div style={{ color: session.isOwner ? '#f9a8d4' : '#a5b4fc', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {session.isOwner ? 'Owner' : 'Manager'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {visibleNav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
          const isOrders = href === '/admin/orders';
          const badgeCount = isOrders && pendingOrderCount > 0 ? pendingOrderCount : 0;
          return (
            <Link key={href} href={href} onClick={onClose} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px',
              color: active ? '#f9fafb' : '#9ca3af',
              background: active ? 'rgba(249,168,212,0.1)' : 'transparent',
              textDecoration: 'none', fontSize: '0.875rem',
              fontWeight: active ? 600 : 400,
              borderLeft: `3px solid ${active ? '#f472b6' : 'transparent'}`,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: '1rem', opacity: active ? 1 : 0.6 }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badgeCount > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 20, height: 20, borderRadius: '50%',
                  background: '#ef4444', color: '#ffffff',
                  fontSize: '0.7rem', fontWeight: 700, lineHeight: 1,
                  padding: '0 4px',
                }}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom links */}
      <div style={{ padding: '12px 20px 0', borderTop: '1px solid #1f2937' }}>
        {!session.isOwner && (
          <Link href="/admin/profile" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 0', color: '#9ca3af', textDecoration: 'none',
            fontSize: '0.8125rem', borderBottom: '1px solid #1f2937', marginBottom: 8,
          }}>
            <span>⚙</span> My Profile
          </Link>
        )}
      </div>

      {/* Logout */}
      <div style={{ padding: '12px 20px 16px' }}>
        <form action={logoutAdmin}>
          <button type="submit" style={{
            width: '100%', padding: '8px 12px',
            background: 'transparent', border: '1px solid #374151', borderRadius: 6,
            color: '#9ca3af', cursor: 'pointer', fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>↩</span> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
