// Server-action authorization helpers. Use at the top of every `'use server'`
// function that mutates admin-scoped data.
//
// `assertOwner()` — strict owner-only (team, settings, dangerous CMS edits).
// `assertPermission('coupons')` — owner OR holder of the named permission.
//
// Both throw `Error('Unauthorized')` which Next.js surfaces as a 403-ish
// runtime error and Sentry captures via the global error handler.

import { getStaffSession } from './staff-auth';
import { can, type Permission } from './permissions';

export async function assertOwner(): Promise<void> {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
}

export async function assertPermission(perm: Permission): Promise<void> {
  const session = await getStaffSession();
  if (!session) throw new Error('Unauthorized');
  if (session.isOwner) return;
  if (!can(session, perm)) throw new Error('Unauthorized');
}
