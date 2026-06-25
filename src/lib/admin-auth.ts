// Server-action authorization helpers. Use at the top of every `'use server'`
// function that mutates admin-scoped data.
//
// `assertOwner()` — strict owner-only (team, settings, dangerous CMS edits).
// `assertPermission('coupons')` — owner OR holder of the named permission.
//
// Both throw `Error('Unauthorized')` which Next.js surfaces as a 403-ish
// runtime error and Sentry captures via the global error handler.
//
// Both return the StaffSession on success so callers can pass it to
// `logAudit(session, ...)` without a second `getStaffSession()` call.

import { getStaffSession } from './staff-auth';
import { can, type Permission, type StaffSession } from './permissions';

export async function assertOwner(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
  return session;
}

export async function assertPermission(perm: Permission): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) throw new Error('Unauthorized');
  if (session.isOwner) return session;
  if (!can(session, perm)) throw new Error('Unauthorized');
  return session;
}

/**
 * Page-level "should this surface be hidden?" check.
 *
 * Returns true when the request lacks the required permission — including the
 * crucial **null session** case. The historical pattern at call sites was:
 *
 *   if (session && !session.isOwner && !session.permissions.includes('X')) { ... }
 *
 * which silently FALLS THROUGH for null sessions, leaving admin pages and
 * actions reachable by an unauthenticated POST/GET (there is no middleware
 * gating /admin/* beyond what each page does itself). Use this helper instead
 * so the gate covers the null-session case by construction. For server actions
 * that should throw, prefer assertPermission() above.
 */
export function lacksPermission(session: StaffSession | null, perm: Permission): boolean {
  if (!session) return true;
  if (session.isOwner) return false;
  return !can(session, perm);
}
