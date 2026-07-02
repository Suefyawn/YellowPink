// Permission-matrix regression suite for the server-action gates.
//
// The 2026-07-02 audit found its admin bugs overwhelmingly in server actions
// and permission gating, so this pins the full matrix: for every permission
// key, a staff session holding exactly that key passes assertPermission for
// it and is rejected for every other key — and the null-session / owner /
// assertOwner edges behave. If a new Permission is added, the matrix picks
// it up automatically via ALL_PERMISSIONS.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_PERMISSIONS, type StaffSession } from './permissions';

const sessionState: { current: StaffSession | null } = { current: null };

vi.mock('./staff-auth', () => ({
  getStaffSession: vi.fn(async () => sessionState.current),
}));

import { assertOwner, assertPermission, lacksPermission } from './admin-auth';

function staff(permissions: StaffSession['permissions'], isOwner = false): StaffSession {
  return {
    id: 's1', email: 'staff@yellowpink.pk', name: 'Matrix Staff',
    permissions, isOwner, roleId: null, roleName: null,
  };
}

beforeEach(() => { sessionState.current = null; });

describe('assertPermission() matrix', () => {
  it('a holder of exactly one permission passes it and only it', async () => {
    for (const held of ALL_PERMISSIONS) {
      sessionState.current = staff([held]);
      await expect(assertPermission(held)).resolves.toMatchObject({ id: 's1' });
      for (const other of ALL_PERMISSIONS) {
        if (other === held) continue;
        await expect(assertPermission(other)).rejects.toThrow('Unauthorized');
      }
    }
  });

  it('owner passes every permission with an empty grant list', async () => {
    sessionState.current = staff([], true);
    for (const perm of ALL_PERMISSIONS) {
      await expect(assertPermission(perm)).resolves.toMatchObject({ isOwner: true });
    }
  });

  it('null session (unauthenticated POST) is rejected for every permission', async () => {
    sessionState.current = null;
    for (const perm of ALL_PERMISSIONS) {
      await expect(assertPermission(perm)).rejects.toThrow('Unauthorized');
    }
  });

  it('an empty permission list is rejected for every permission', async () => {
    sessionState.current = staff([]);
    for (const perm of ALL_PERMISSIONS) {
      await expect(assertPermission(perm)).rejects.toThrow('Unauthorized');
    }
  });
});

describe('assertOwner()', () => {
  it('rejects a non-owner even if they hold every permission', async () => {
    sessionState.current = staff([...ALL_PERMISSIONS]);
    await expect(assertOwner()).rejects.toThrow('Unauthorized');
  });

  it('accepts the owner', async () => {
    sessionState.current = staff([], true);
    await expect(assertOwner()).resolves.toMatchObject({ isOwner: true });
  });

  it('rejects a null session', async () => {
    sessionState.current = null;
    await expect(assertOwner()).rejects.toThrow('Unauthorized');
  });
});

describe('lacksPermission()', () => {
  it('treats a null session as lacking every permission', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(lacksPermission(null, perm)).toBe(true);
    }
  });

  it('owner lacks nothing', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(lacksPermission(staff([], true), perm)).toBe(false);
    }
  });

  it('holder lacks exactly the permissions not granted', () => {
    const s = staff(['blog', 'orders.view']);
    expect(lacksPermission(s, 'blog')).toBe(false);
    expect(lacksPermission(s, 'orders.view')).toBe(false);
    expect(lacksPermission(s, 'orders.edit')).toBe(true);
    expect(lacksPermission(s, 'settings')).toBe(true);
  });
});
