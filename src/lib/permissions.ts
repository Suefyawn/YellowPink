// ─── Permissions ─────────────────────────────────────────────────────────────
// Fine-grained capability strings. Owners implicitly hold every permission;
// staff hold whatever the owner has granted them — either via an assigned role
// (the `roles` table) or, for a "Custom" staff member, via their own
// `staff_members.permissions text[]` column.
//
// Adding a permission:
//   1. Append to the Permission union + ALL_PERMISSIONS
//   2. Add an entry to PERMISSION_META (label, icon, group, description)
//   3. Use `can(session, 'new_perm')` at the call-site

export type Permission =
  // ── Commerce ──
  | 'orders'
  | 'products'
  | 'customers'
  | 'coupons'
  | 'returns'

  // ── Content + marketing ──
  | 'blog'
  | 'promos'
  | 'reviews'
  | 'newsletter'

  // ── Analytics & monitoring (split so a marketer can see traffic without
  //    seeing Sentry stack traces, and vice-versa) ──
  | 'analytics'             // overview dashboard + revenue chart + top products
  | 'analytics_traffic'     // PostHog widgets: funnel, top pages/events, referrers
  | 'analytics_errors'      // Sentry widgets: trend, issues, top routes
  | 'analytics_refresh'     // can hit the "Refresh analytics" button

  // ── Store admin ──
  | 'settings';             // store settings (shipping, tax, store info)

export const ALL_PERMISSIONS: Permission[] = [
  'orders', 'products', 'customers', 'coupons', 'returns',
  'blog', 'promos', 'reviews', 'newsletter',
  'analytics', 'analytics_traffic', 'analytics_errors', 'analytics_refresh',
  'settings',
];

export type PermissionGroup = 'commerce' | 'content' | 'analytics' | 'store';

export const PERMISSION_META: Record<Permission, {
  label: string;
  icon: string;
  desc: string;
  group: PermissionGroup;
}> = {
  // Commerce
  orders:    { label: 'Orders',     icon: '◎', desc: 'View, fulfil, and update customer orders.',    group: 'commerce' },
  products:  { label: 'Products',   icon: '◈', desc: 'Create, edit, publish, and delete products.',  group: 'commerce' },
  customers: { label: 'Customers',  icon: '◉', desc: 'View customer accounts + segment lists.',      group: 'commerce' },
  coupons:   { label: 'Coupons',    icon: '◇', desc: 'Issue and manage discount codes.',             group: 'commerce' },
  returns:   { label: 'Returns',    icon: '↩', desc: 'Approve / reject customer return requests.',   group: 'commerce' },

  // Content + marketing
  blog:    { label: 'Blog',    icon: '✦', desc: 'Write and publish editorial posts.',                group: 'content' },
  promos:  { label: 'Promos',  icon: '✧', desc: 'Author top-bar + hero-strip campaigns.',           group: 'content' },
  reviews: { label: 'Reviews', icon: '★', desc: 'Moderate, reply to, and feature customer reviews.', group: 'content' },
  newsletter: { label: 'Newsletter', icon: '✉', desc: 'Compose and send the email newsletter to subscribers.', group: 'content' },

  // Analytics
  analytics:           { label: 'Overview analytics', icon: '▣', desc: 'Revenue chart, orders-by-status, top products, low-stock alerts.', group: 'analytics' },
  analytics_traffic:   { label: 'Traffic insights',   icon: '📊', desc: 'PostHog stats: pageviews, conversion funnel, top pages, top events, referrers.', group: 'analytics' },
  analytics_errors:    { label: 'Error monitoring',   icon: '🐛', desc: 'Sentry stats: error trend, unresolved issues, top affected URLs. Receives Sentry notifications.', group: 'analytics' },
  analytics_refresh:   { label: 'Refresh analytics',  icon: '⟳', desc: 'Trigger a manual PostHog + Sentry data refresh.', group: 'analytics' },

  // Store admin
  settings: { label: 'Store settings', icon: '⚙', desc: 'Edit store profile, shipping zones, tax rules, email templates.', group: 'store' },
};

export const GROUP_META: Record<PermissionGroup, { label: string; desc: string }> = {
  commerce:  { label: 'Commerce',  desc: 'Customer-facing operations: orders, catalog, support.' },
  content:   { label: 'Content & marketing', desc: 'Editorial, promos, social.' },
  analytics: { label: 'Analytics & monitoring', desc: 'Dashboards, traffic data, error tracking.' },
  store:     { label: 'Store admin', desc: 'Configuration and platform settings.' },
};

// ─── Session ────────────────────────────────────────────────────────────────
export interface StaffSession {
  id: string;
  email: string;
  name: string;
  /** Effective permissions — resolved from the assigned role, or the staff
   *  member's own permissions column when they have no role ("Custom"). */
  permissions: Permission[];
  isOwner: boolean;
  /** Assigned role, or null for the owner / a "Custom" staff member. */
  roleId: string | null;
  roleName: string | null;
}

export function can(session: StaffSession | null | undefined, permission: Permission): boolean {
  if (!session) return false;
  if (session.isOwner) return true;
  return session.permissions.includes(permission);
}

/** Convenience: true if the session can see at least one of the listed perms.
 *  Useful for showing/hiding entire dashboard sections that contain multiple
 *  permission-gated widgets. */
export function canAny(session: StaffSession | null | undefined, permissions: Permission[]): boolean {
  if (!session) return false;
  if (session.isOwner) return true;
  return permissions.some(p => session.permissions.includes(p));
}
