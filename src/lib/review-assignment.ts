import 'server-only';
import { log } from './logger';

// Reviewer-credit notification — RETIRED (owner decision, 1 Sep 2026).
//
// Crediting a board doctor used to email them on every assignment (auto,
// manual pick, or reassignment). The owner asked for that to stop: with a
// post published daily, the assignment emails were noise, and the doctors
// already see every article credited to them on their reviewer dashboard
// (their profile page lists all their credited posts). Assignment itself is
// unchanged — the DB trigger, the blog form's picker and the reassignment
// controls all still credit the doctor and stamp review_status; only the
// email is gone.
//
// The function is kept as a no-op (rather than deleting the call sites) so
// re-enabling later is a one-file change. It logs at debug level for the
// audit trail.

/** Formerly emailed the doctor credited on a post. Now a deliberate no-op:
 *  doctors see their credited articles on their dashboard instead. */
export async function notifyReviewerCredited(postId: string): Promise<void> {
  log.info('review_assignment.credit_email_skipped', { postId, reason: 'assignment emails retired 2026-09-01' });
}
