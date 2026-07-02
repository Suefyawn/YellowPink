'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAdmin } from '@/app/admin/actions';
import { AdminIcon, type AdminIconName } from '@/components/ui/AdminIcon';
import type { StaffSession, Permission } from '@/lib/permissions';

// `permissionsAny` = nav item visible if the session holds ANY of these perms
// (mirrors the canAny() helper). Use the array form for surfaces that can be
// granted via multiple permissions (e.g. dashboard reachable via any of three
// analytics perms). Single-permission rows use `permission` for brevity.
// Icons are inline SVGs from AdminIcon (lucide-style, currentColor) — never
// Unicode glyphs/emoji, which pick up the OS emoji font and clash with the
// brand.
type NavItem = {
  href: string;
  label: string;
  icon: AdminIconName;
  permission?: Permission;
  permissionsAny?: Permission[];
  ownerOnly?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { label: 'Insights', items: [
    { href: '/admin/dashboard', label: 'Dashboard', icon: 'layout-dashboard', permissionsAny: ['analytics','analytics_traffic','analytics_errors'] },
    { href: '/admin/analytics', label: 'Analytics', icon: 'pie-chart', permission: 'analytics' },
    { href: '/admin/finance',   label: 'Finance',   icon: 'banknote', permission: 'finance' },
    { href: '/admin/finance/cod', label: 'COD',     icon: 'coins', permission: 'finance' },
  ]},
  { label: 'Sell', items: [
    { href: '/admin/orders',    label: 'Orders',    icon: 'shopping-bag', permission: 'orders.view' },
    { href: '/admin/products',  label: 'Products',  icon: 'package', permission: 'products.view' },
    { href: '/admin/tags',      label: 'Tags',      icon: 'tag', permission: 'products.view' },
    { href: '/admin/collections', label: 'Collections', icon: 'layers', permission: 'products.view' },
    { href: '/admin/brands',    label: 'Brands',    icon: 'gem', permission: 'products.view' },
    { href: '/admin/inventory', label: 'Inventory', icon: 'clipboard-list', permission: 'products.view' },
    { href: '/admin/vendors',   label: 'Vendors',   icon: 'truck', permission: 'orders.view' },
    { href: '/admin/returns',   label: 'Returns',   icon: 'undo', permission: 'returns' },
  ]},
  { label: 'People', items: [
    { href: '/admin/users',     label: 'Customers', icon: 'users', permission: 'customers.view' },
    { href: '/admin/segments',  label: 'Segments',  icon: 'target', permission: 'customers.view' },
    { href: '/admin/coupons',   label: 'Coupons',   icon: 'ticket', permission: 'coupons' },
  ]},
  { label: 'Marketing', items: [
    { href: '/admin/blog',      label: 'Blog',      icon: 'pen-line', permission: 'blog' },
    { href: '/admin/reviewers', label: 'Review Board', icon: 'shield-check', permission: 'blog' },
    { href: '/admin/reviews',   label: 'Reviews',   icon: 'star', permission: 'reviews' },
    { href: '/admin/messages',  label: 'Messages',  icon: 'message-circle', permission: 'messages' },
    { href: '/admin/newsletter', label: 'Newsletter', icon: 'mail', permission: 'newsletter' },
    { href: '/admin/emails',    label: 'Email log', icon: 'inbox', permission: 'settings' },
  ]},
  { label: 'Store', items: [
    { href: '/admin/broken-links', label: 'Broken links', icon: 'link-off', permission: 'settings' },
    { href: '/admin/indexing', label: 'Indexing', icon: 'search', permission: 'settings' },
    { href: '/admin/audit',     label: 'Activity log', icon: 'history', ownerOnly: true },
    { href: '/admin/team',      label: 'Team',      icon: 'user-check', ownerOnly: true },
    { href: '/admin/settings',  label: 'Settings',  icon: 'settings', permission: 'settings' },
  ]},
];

function canSee(item: NavItem, session: StaffSession): boolean {
  if (item.ownerOnly) return session.isOwner;
  if (session.isOwner) return true;
  if (item.permission)     return session.permissions.includes(item.permission);
  if (item.permissionsAny) return item.permissionsAny.some(p => session.permissions.includes(p));
  return true;
}

export function AdminSidebar({ session, onClose, pendingOrderCount = 0, unreadMessageCount = 0 }: { session: StaffSession; onClose?: () => void; pendingOrderCount?: number; unreadMessageCount?: number }) {
  const pathname = usePathname();
  const visibleGroups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => canSee(item, session)) }))
    .filter(g => g.items.length > 0);

  return (
    <aside id="admin-sidebar" style={{
      width: '100%', background: '#111827', height: '100%', minHeight: 0,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
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
          <button
            onClick={onClose}
            aria-label="Close admin menu"
            style={{
              background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
              lineHeight: 1,
              width: 40, height: 40, borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginRight: -8,
            }}
          ><AdminIcon name="x" size={16} strokeWidth={2} /></button>
        )}
      </div>

      {/* User badge */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: session.isOwner ? '#C5286A' : '#6366f1',
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
            {session.isOwner ? 'Owner' : (session.roleName ?? 'Staff')}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {visibleGroups.map((group, groupIdx) => (
          <div key={group.label} style={{ marginTop: groupIdx === 0 ? 0 : 12 }}>
            <div style={{
              padding: '8px 20px 4px',
              color: '#6b7280',
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {group.label}
            </div>
            {group.items.map(({ href, label, icon }) => {
              const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
              const badgeCount =
                href === '/admin/orders'   && pendingOrderCount  > 0 ? pendingOrderCount  :
                href === '/admin/messages' && unreadMessageCount > 0 ? unreadMessageCount :
                0;
              return (
                <Link key={href} href={href} onClick={onClose} className="adm-nav-link" style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  // 44 px min tap target for mobile phones, desktop still looks
                  // tight because the font size is 0.875rem so the row reads
                  // compactly.
                  padding: '12px 20px',
                  minHeight: 44,
                  color: active ? '#f9fafb' : '#9ca3af',
                  background: active ? 'rgba(249,168,212,0.1)' : 'transparent',
                  textDecoration: 'none', fontSize: '0.875rem',
                  fontWeight: active ? 600 : 400,
                  borderLeft: `3px solid ${active ? '#f472b6' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}>
                  <span style={{ display: 'inline-flex', opacity: active ? 1 : 0.6 }}>
                    <AdminIcon name={icon} size={16} strokeWidth={2} />
                  </span>
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
          </div>
        ))}
      </nav>

      {/* Bottom links */}
      <div style={{ padding: '12px 20px 0', borderTop: '1px solid #1f2937' }}>
        {!session.isOwner && (
          <Link href="/admin/profile" onClick={onClose} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 0', color: '#9ca3af', textDecoration: 'none',
            fontSize: '0.8125rem',
          }}>
            <AdminIcon name="user" size={14} strokeWidth={2} style={{ flexShrink: 0 }} /> My Profile
          </Link>
        )}
        {/* User manual, visible to every signed-in staff member so anyone with
            admin access can learn how the store + storefront work. */}
        <Link href="/admin/help" onClick={onClose} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 0', color: '#9ca3af', textDecoration: 'none',
          fontSize: '0.8125rem', borderTop: '1px solid #1f2937', marginTop: 8,
        }}>
          <AdminIcon name="book-open" size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
          User manual
        </Link>
      </div>

      {/* Logout */}
      <div style={{ padding: '12px 20px 16px' }}>
        <form action={logoutAdmin}>
          <button type="submit" className="adm-signout" style={{
            width: '100%', padding: '8px 12px',
            background: 'transparent', border: '1px solid #374151', borderRadius: 6,
            color: '#9ca3af', cursor: 'pointer', fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AdminIcon name="log-out" size={14} strokeWidth={2} style={{ flexShrink: 0 }} /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
