// ─── Permissions ─────────────────────────────────────────────────────────────
// Fine-grained capability strings. Owners implicitly hold every permission;
// staff hold whatever the owner has granted them, either via an assigned role
// (the `roles` table) or, for a "Custom" staff member, via their own
// `staff_members.permissions text[]` column.
//
// Adding a permission:
//   1. Append to the Permission union + ALL_PERMISSIONS
//   2. Add an entry to PERMISSION_META (label, group, description)
//   3. Gate the page/action with `can(session, 'new_perm')` and, if it has a
//      sidebar entry, reference it in lib/admin-nav.ts — the Team checklist's
//      "Unlocks:" line is generated from that table.

export type Permission =
  // ── Insights ──
  | 'analytics'             // Analytics page + Dashboard insights widgets
  | 'analytics_traffic'     // PostHog widgets: funnel, top pages/events, referrers
  | 'analytics_errors'      // Sentry widgets: trend, issues, top routes
  | 'analytics_refresh'     // can hit the "Refresh analytics" button
  | 'finance'               // P&L, expenses, margins, COD cash reconciliation

  // ── Sell — orders / products / customers are split into view·edit·delete so
  //    e.g. a support agent can read orders without being able to refund or
  //    cancel them ──
  | 'orders.view'
  | 'orders.edit'
  | 'orders.delete'
  | 'returns'
  | 'vendors'               // vendor directory, rates and settlements

  // ── Catalogue ──
  | 'products.view'
  | 'products.edit'
  | 'products.delete'

  // ── Customers ──
  | 'customers.view'
  | 'customers.edit'
  | 'customers.delete'
  | 'messages'
  | 'reviews'

  // ── Marketing ──
  | 'coupons'
  | 'blog'
  | 'newsletter'
  | 'outreach'              // press/backlink outreach desk: pitches, sends, replies

  // ── System ──
  | 'settings'              // store settings (shipping, payments, notifications…)
  | 'system_tools';         // Email log, Broken links, Indexing

export const ALL_PERMISSIONS: Permission[] = [
  'analytics', 'analytics_traffic', 'analytics_errors', 'analytics_refresh', 'finance',
  'orders.view', 'orders.edit', 'orders.delete', 'returns', 'vendors',
  'products.view', 'products.edit', 'products.delete',
  'customers.view', 'customers.edit', 'customers.delete', 'messages', 'reviews',
  'coupons', 'blog', 'newsletter', 'outreach',
  'settings', 'system_tools',
];

// Groups mirror the admin sidebar 1:1 (Insights / Sell / Catalogue /
// Customers / Marketing / System) so the Team checklist reads like the nav.
export type PermissionGroup = 'insights' | 'sell' | 'catalogue' | 'customers' | 'marketing' | 'system';

export const PERMISSION_META: Record<Permission, {
  label: string;
  desc: string;
  group: PermissionGroup;
}> = {
  // Insights
  analytics:         { label: 'Overview analytics', desc: 'Sales/customer analytics tabs, revenue chart, top products.', group: 'insights' },
  analytics_traffic: { label: 'Traffic insights',   desc: 'Traffic & funnel tabs: pageviews, conversion funnel, top pages, referrers.', group: 'insights' },
  analytics_errors:  { label: 'Error monitoring',   desc: 'Sentry widgets: error trend, unresolved issues, top affected URLs.', group: 'insights' },
  analytics_refresh: { label: 'Refresh analytics',  desc: 'Trigger a manual analytics data refresh.', group: 'insights' },
  finance:           { label: 'Finance & reports',  desc: 'Profit & loss, expenses, margins, COD cash reconciliation. Sensitive financial data.', group: 'insights' },

  // Sell
  'orders.view':   { label: 'Orders, View',   desc: 'View customer orders and their details.', group: 'sell' },
  'orders.edit':   { label: 'Orders, Manage', desc: 'Update status, fulfil, confirm, dispatch; assign an order to a vendor.', group: 'sell' },
  'orders.delete': { label: 'Orders, Delete', desc: 'Delete orders.', group: 'sell' },
  returns:         { label: 'Returns',        desc: 'Approve / reject customer return requests.', group: 'sell' },
  vendors:         { label: 'Vendors',        desc: 'Manage the vendor directory, rates, and settlements (money owed to/by vendors).', group: 'sell' },

  // Catalogue
  'products.view':   { label: 'Products, View',   desc: 'Browse the catalogue, stock levels, collections, brands and tags.', group: 'catalogue' },
  'products.edit':   { label: 'Products, Edit',   desc: 'Create and edit products, variants, stock, collections, brands and tags.', group: 'catalogue' },
  'products.delete': { label: 'Products, Delete', desc: 'Delete products from the catalogue.', group: 'catalogue' },

  // Customers
  'customers.view':   { label: 'Customers, View',   desc: 'View customer accounts and segment lists.', group: 'customers' },
  'customers.edit':   { label: 'Customers, Edit',   desc: 'Edit customer account details.', group: 'customers' },
  'customers.delete': { label: 'Customers, Delete', desc: 'Delete customer accounts.', group: 'customers' },
  messages: { label: 'Messages', desc: 'Read and manage customer contact-form messages.', group: 'customers' },
  reviews:  { label: 'Reviews',  desc: 'Moderate, reply to, and feature customer reviews.', group: 'customers' },

  // Marketing
  coupons:    { label: 'Coupons',    desc: 'Issue and manage discount codes.', group: 'marketing' },
  blog:       { label: 'Blog',       desc: 'Write and publish editorial posts; manage medical reviewers.', group: 'marketing' },
  newsletter: { label: 'Newsletter', desc: 'Compose and send the email newsletter to subscribers.', group: 'marketing' },
  outreach:   { label: 'Outreach',   desc: 'Press and backlink outreach: edit pitch drafts, send from the store address, read and answer replies.', group: 'marketing' },

  // System
  settings:     { label: 'Store settings', desc: 'Edit store profile, payments, shipping zones, notifications, integrations.', group: 'system' },
  system_tools: { label: 'System tools',   desc: 'Email delivery log, broken-link triage, search-engine indexing tools.', group: 'system' },
};

export const GROUP_META: Record<PermissionGroup, { label: string; desc: string }> = {
  insights:  { label: 'Insights',  desc: 'Dashboards, analytics, finance.' },
  sell:      { label: 'Sell',      desc: 'Orders, returns, vendors.' },
  catalogue: { label: 'Catalogue', desc: 'Products, inventory, collections, brands, tags.' },
  customers: { label: 'Customers', desc: 'Accounts, segments, messages, reviews.' },
  marketing: { label: 'Marketing', desc: 'Coupons, blog, newsletter.' },
  system:    { label: 'System',    desc: 'Settings and operational tools.' },
};

export const GROUPS_ORDER: PermissionGroup[] = ['insights', 'sell', 'catalogue', 'customers', 'marketing', 'system'];

// ─── Session ────────────────────────────────────────────────────────────────
export interface StaffSession {
  id: string;
  email: string;
  name: string;
  /** Effective permissions, resolved from the assigned role, or the staff
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

// Stored permission arrays are text[] in Postgres, drop anything that isn't a
// live permission token (retired grants, typos) instead of carrying it into
// the session. The legacy 'orders'/'products'/'customers' bundle tokens were
// expanded by migration 125 and verified gone from prod, the expansion shim
// that used to live here is retired.
const VALID = new Set<string>(ALL_PERMISSIONS);
export function sanitizePermissions(permissions: string[]): Permission[] {
  return [...new Set(permissions.filter(p => VALID.has(p)))] as Permission[];
}
