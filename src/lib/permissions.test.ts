import { describe, expect, it } from 'vitest';
import {
  can, canAny, sanitizePermissions, ALL_PERMISSIONS,
  type StaffSession,
} from './permissions';

const baseSession: StaffSession = {
  id: 's1', email: 'manager@yellowpink.pk', name: 'Test',
  permissions: [], isOwner: false, roleId: null, roleName: null,
};

describe('can()', () => {
  it('returns true for owners regardless of perm', () => {
    expect(can({ ...baseSession, isOwner: true }, 'analytics_errors')).toBe(true);
  });

  it('returns true when perm is present', () => {
    expect(can({ ...baseSession, permissions: ['analytics_traffic'] }, 'analytics_traffic')).toBe(true);
  });

  it('returns false when perm is absent', () => {
    expect(can({ ...baseSession, permissions: ['orders.view'] }, 'analytics_errors')).toBe(false);
  });

  it('distinguishes view / edit / delete on the same resource', () => {
    const s: StaffSession = { ...baseSession, permissions: ['orders.view'] };
    expect(can(s, 'orders.view')).toBe(true);
    expect(can(s, 'orders.edit')).toBe(false);
    expect(can(s, 'orders.delete')).toBe(false);
  });

  it('treats null/undefined session as no access', () => {
    expect(can(null, 'orders.view')).toBe(false);
    expect(can(undefined, 'orders.view')).toBe(false);
  });
});

describe('canAny()', () => {
  it('returns true when at least one perm matches', () => {
    const s: StaffSession = { ...baseSession, permissions: ['analytics_traffic'] };
    expect(canAny(s, ['analytics', 'analytics_traffic', 'analytics_errors'])).toBe(true);
  });

  it('returns false when none match', () => {
    const s: StaffSession = { ...baseSession, permissions: ['orders.view'] };
    expect(canAny(s, ['analytics', 'analytics_traffic', 'analytics_errors'])).toBe(false);
  });

  it('passes through for owners', () => {
    expect(canAny({ ...baseSession, isOwner: true }, ['settings'])).toBe(true);
  });
});

describe('sanitizePermissions()', () => {
  it('keeps live permission tokens', () => {
    expect(sanitizePermissions(['orders.view', 'blog', 'vendors', 'system_tools']))
      .toEqual(['orders.view', 'blog', 'vendors', 'system_tools']);
  });

  it('drops retired/unknown tokens (legacy bundles were expanded by migration 125)', () => {
    expect(sanitizePermissions(['orders', 'not-a-perm', 'orders.view'])).toEqual(['orders.view']);
  });

  it('dedupes repeated tokens', () => {
    expect(sanitizePermissions(['orders.view', 'orders.view'])).toEqual(['orders.view']);
  });
});

describe('ALL_PERMISSIONS', () => {
  it('exposes the split commerce permissions', () => {
    expect(ALL_PERMISSIONS).toContain('orders.view');
    expect(ALL_PERMISSIONS).toContain('products.edit');
    expect(ALL_PERMISSIONS).toContain('customers.delete');
  });
});
