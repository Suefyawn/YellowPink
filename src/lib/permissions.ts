// ─── Permissions ─────────────────────────────────────────────────────────────
// Fine-grained capability strings stored in `staff_members.permissions text[]`.
// Owners implicitly hold every permission; managers hold whatever the owner
// has granted them. Role templates (`ROLE_TEMPLATES`) bundle common sets so
// the team UI doesn't have to click 10 checkboxes for an "Analyst".
//
// Adding a permission:
//   1. Append to the Permission union + ALL_PERMISSIONS
//   2. Add an entry to PERMISSION_META (label, icon, group, description)
//   3. Optionally add it to one or more ROLE_TEMPLATES bundles
//   4. Use `can(session, 'new_perm')` at the call-site

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

// ─── Role templates ─────────────────────────────────────────────────────────
// Named bundles you can apply with a single click in the team UI. After
// applying a template you can still toggle individual permissions on/off,
// so templates are a starting point, not a constraint.
//
// The keys are stable so you can store the chosen template on `staff_members`
// later if we want to display it in the table. (Not stored today — perms are
// the source of truth, the role is purely an authoring convenience.)

export type RoleKey = 'owner' | 'manager' | 'marketer' | 'support' | 'inventory' | 'analyst' | 'custom';

export interface RoleTemplate {
  key: RoleKey;
  label: string;
  description: string;
  /** Empty for `owner` (which is the isOwner flag, not perms) and `custom`. */
  permissions: Permission[];
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: 'manager',
    label: 'Manager',
    description: 'Full operational access — everything except platform settings.',
    permissions: [
      'orders', 'products', 'customers', 'coupons', 'returns',
      'blog', 'promos', 'reviews', 'newsletter',
      'analytics', 'analytics_traffic', 'analytics_errors', 'analytics_refresh',
    ],
  },
  {
    key: 'marketer',
    label: 'Marketer',
    description: 'Content, promos, coupons, and traffic insights — no orders or customer PII.',
    permissions: [
      'blog', 'promos', 'reviews', 'newsletter', 'coupons',
      'analytics', 'analytics_traffic',
    ],
  },
  {
    key: 'support',
    label: 'Customer support',
    description: 'Orders, customers, and returns — no editorial or catalog changes.',
    permissions: ['orders', 'customers', 'returns'],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Products only — catalog + stock management.',
    permissions: ['products'],
  },
  {
    key: 'analyst',
    label: 'Analyst',
    description: 'Read-only access to every analytics + monitoring surface.',
    permissions: ['analytics', 'analytics_traffic', 'analytics_errors', 'analytics_refresh'],
  },
  {
    key: 'custom',
    label: 'Custom',
    description: 'No template — pick individual permissions below.',
    permissions: [],
  },
];

/** Find the role whose permission set exactly matches the input, if any.
 *  Used by the team UI to pre-select the dropdown when editing an existing row. */
export function matchRole(permissions: Permission[]): RoleKey {
  const set = new Set(permissions);
  for (const r of ROLE_TEMPLATES) {
    if (r.key === 'custom') continue;
    if (r.permissions.length !== set.size) continue;
    if (r.permissions.every(p => set.has(p))) return r.key;
  }
  return 'custom';
}

// ─── Session ────────────────────────────────────────────────────────────────
export interface StaffSession {
  id: string;
  email: string;
  name: string;
  permissions: Permission[];
  isOwner: boolean;
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
