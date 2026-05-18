import { describe, expect, it } from 'vitest';
import {
  can, canAny, matchRole, ALL_PERMISSIONS, ROLE_TEMPLATES,
  type StaffSession,
} from './permissions';

const baseSession: StaffSession = {
  id: 's1', email: 'manager@yellowpink.pk', name: 'Test',
  permissions: [], isOwner: false,
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

describe('matchRole()', () => {
  it('detects an exact Marketer match', () => {
    const marketer = ROLE_TEMPLATES.find(r => r.key === 'marketer')!;
    expect(matchRole(marketer.permissions)).toBe('marketer');
  });

  it('detects an exact Analyst match', () => {
    const analyst = ROLE_TEMPLATES.find(r => r.key === 'analyst')!;
    expect(matchRole(analyst.permissions)).toBe('analyst');
  });

  it('returns custom for a permission set that doesn\'t match a template', () => {
    expect(matchRole(['orders', 'analytics_errors'])).toBe('custom');
  });

  it('returns custom for an empty permission set', () => {
    expect(matchRole([])).toBe('custom');
  });

  it('is order-independent', () => {
    const support = ROLE_TEMPLATES.find(r => r.key === 'support')!;
    const shuffled = [...support.permissions].reverse();
    expect(matchRole(shuffled)).toBe('support');
  });
});

describe('ALL_PERMISSIONS', () => {
  it('contains every permission referenced by ROLE_TEMPLATES', () => {
    const universe = new Set<string>(ALL_PERMISSIONS);
    for (const role of ROLE_TEMPLATES) {
      for (const p of role.permissions) {
        expect(universe.has(p), `template ${role.key} references unknown permission ${p}`).toBe(true);
      }
    }
  });

  it('exposes the new analytics permissions', () => {
    expect(ALL_PERMISSIONS).toContain('analytics_traffic');
    expect(ALL_PERMISSIONS).toContain('analytics_errors');
    expect(ALL_PERMISSIONS).toContain('analytics_refresh');
  });
});
