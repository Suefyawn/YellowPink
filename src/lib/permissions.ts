export type Permission =
  | 'analytics'
  | 'orders'
  | 'products'
  | 'blog'
  | 'coupons'
  | 'customers';

export const ALL_PERMISSIONS: Permission[] = [
  'analytics',
  'orders',
  'products',
  'blog',
  'coupons',
  'customers',
];

export const PERMISSION_META: Record<Permission, { label: string; icon: string; desc: string }> = {
  analytics: { label: 'Analytics',  icon: '▣', desc: 'View dashboard and sales reports' },
  orders:    { label: 'Orders',     icon: '◎', desc: 'View and manage customer orders' },
  products:  { label: 'Products',   icon: '◈', desc: 'Add, edit, and delete products' },
  blog:      { label: 'Blog',       icon: '✦', desc: 'Create and publish blog posts' },
  coupons:   { label: 'Coupons',    icon: '◇', desc: 'Create and manage discount coupons' },
  customers: { label: 'Customers',  icon: '◉', desc: 'View customer accounts' },
};

export interface StaffSession {
  id: string;
  email: string;
  name: string;
  permissions: Permission[];
  isOwner: boolean;
}

export function can(session: StaffSession, permission: Permission): boolean {
  return session.isOwner || session.permissions.includes(permission);
}
