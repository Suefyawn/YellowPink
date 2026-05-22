import { describe, expect, it } from 'vitest';
import {
  can, canAny, ALL_PERMISSIONS,
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
    expect(can({ ...baseSession, permissions: ['orders'] }, 'analytics_errors')).toBe(false);
  });

  it('treats null/undefined session as no access', () => {
    expect(can(null, 'orders')).toBe(false);
    expect(can(undefined, 'orders')).toBe(false);
  });
});

describe('canAny()', () => {
  it('returns true when at least one perm matches', () => {
    const s: StaffSession = { ...baseSession, permissions: ['analytics_traffic'] };
    expect(canAny(s, ['analytics', 'analytics_traffic', 'analytics_errors'])).toBe(true);
  });

  it('returns false when none match', () => {
    const s: StaffSession = { ...baseSession, permissions: ['orders'] };
    expect(canAny(s, ['analytics', 'analytics_traffic', 'analytics_errors'])).toBe(false);
  });

  it('passes through for owners', () => {
    expect(canAny({ ...baseSession, isOwner: true }, ['settings'])).toBe(true);
  });
});

describe('ALL_PERMISSIONS', () => {
  it('exposes the analytics permissions', () => {
    expect(ALL_PERMISSIONS).toContain('analytics_traffic');
    expect(ALL_PERMISSIONS).toContain('analytics_errors');
    expect(ALL_PERMISSIONS).toContain('analytics_refresh');
  });
});
