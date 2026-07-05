import type { Permission, StaffSession } from './permissions';

// ─── Admin navigation, the single source of truth ───────────────────────────
// The sidebar, the Team page's permission checklist ("Unlocks: …" lines) and
// the post-login landing page all derive from this table, so what a permission
// unlocks and what the nav shows can never drift apart again (the 2026-07
// audit found 4 checklist groups vs 6 sidebar groups and descriptions that
// omitted half of what a permission opened).

export interface AdminNavItem {
  href: string;
  label: string;
  /** lucide icon name, rendered by the sidebar's icon map. */
  icon: string;
  /** Visible when the session holds this permission. */
  permission?: Permission;
  /** Visible when the session holds ANY of these. */
  permissionsAny?: Permission[];
  /** Owner only (Team, Activity log). */
  ownerOnly?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { label: 'Insights', items: [
    { href: '/admin/dashboard', label: 'Dashboard', icon: 'layout-dashboard', permissionsAny: ['analytics', 'analytics_traffic', 'analytics_errors'] },
    { href: '/admin/analytics', label: 'Analytics', icon: 'pie-chart', permission: 'analytics' },
    { href: '/admin/finance',   label: 'Finance',   icon: 'banknote', permission: 'finance' },
  ]},
  { label: 'Sell', items: [
    { href: '/admin/orders',    label: 'Orders',    icon: 'shopping-bag', permission: 'orders.view' },
    { href: '/admin/products',  label: 'Products',  icon: 'package', permission: 'products.view' },
    { href: '/admin/inventory', label: 'Inventory', icon: 'clipboard-list', permission: 'products.view' },
    { href: '/admin/returns',   label: 'Returns',   icon: 'undo', permission: 'returns' },
    { href: '/admin/vendors',   label: 'Vendors',   icon: 'truck', permission: 'vendors' },
  ]},
  { label: 'Catalogue', items: [
    { href: '/admin/collections', label: 'Collections', icon: 'layers', permission: 'products.view' },
    { href: '/admin/brands',    label: 'Brands',    icon: 'gem', permission: 'products.view' },
    { href: '/admin/tags',      label: 'Tags',      icon: 'tag', permission: 'products.view' },
  ]},
  { label: 'Customers', items: [
    { href: '/admin/users',     label: 'Customers', icon: 'users', permission: 'customers.view' },
    { href: '/admin/segments',  label: 'Segments',  icon: 'target', permission: 'customers.view' },
    { href: '/admin/messages',  label: 'Messages',  icon: 'message-circle', permission: 'messages' },
    { href: '/admin/reviews',   label: 'Reviews',   icon: 'star', permission: 'reviews' },
  ]},
  { label: 'Marketing', items: [
    { href: '/admin/coupons',   label: 'Coupons',   icon: 'ticket', permission: 'coupons' },
    { href: '/admin/blog',      label: 'Blog',      icon: 'pen-line', permission: 'blog' },
    { href: '/admin/reviewers', label: 'Medical reviewers', icon: 'shield-check', permission: 'blog' },
    { href: '/admin/newsletter', label: 'Newsletter', icon: 'mail', permission: 'newsletter' },
    { href: '/admin/link-builder', label: 'Link builder', icon: 'megaphone', permissionsAny: ['analytics', 'newsletter', 'coupons'] },
    { href: '/admin/search-demand', label: 'Search demand', icon: 'bar-chart', permissionsAny: ['analytics', 'products.view', 'blog'] },
  ]},
  { label: 'System', items: [
    { href: '/admin/settings',  label: 'Settings',  icon: 'settings', permission: 'settings' },
    { href: '/admin/team',      label: 'Team',      icon: 'user-check', ownerOnly: true },
    { href: '/admin/audit',     label: 'Activity log', icon: 'history', ownerOnly: true },
    { href: '/admin/emails',    label: 'Email log', icon: 'inbox', permission: 'system_tools' },
    { href: '/admin/broken-links', label: 'Broken links', icon: 'link-off', permission: 'system_tools' },
    { href: '/admin/indexing', label: 'Indexing', icon: 'search', permission: 'system_tools' },
  ]},
];

export function canSeeNavItem(item: AdminNavItem, session: StaffSession): boolean {
  if (item.ownerOnly) return session.isOwner;
  if (session.isOwner) return true;
  if (item.permission)     return session.permissions.includes(item.permission);
  if (item.permissionsAny) return item.permissionsAny.some(p => session.permissions.includes(p));
  return true;
}

/** Where to land this session after login: the first sidebar item they can
 *  actually see. Staff without any analytics permission used to be hard-sent
 *  to /admin/dashboard and greeted with "Access Restricted" on every login. */
export function adminHomeFor(session: StaffSession): string {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (canSeeNavItem(item, session)) return item.href;
    }
  }
  // A session with zero permissions still has a profile page.
  return '/admin/profile';
}

/** Sidebar labels a permission unlocks — feeds the Team checklist so the
 *  descriptions are generated from the nav table, not hand-maintained. */
export function navUnlocksFor(permission: Permission): string[] {
  const labels: string[] = [];
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (item.permission === permission || item.permissionsAny?.includes(permission)) {
        labels.push(item.label);
      }
    }
  }
  return labels;
}
