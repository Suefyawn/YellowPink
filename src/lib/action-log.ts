// ============================================================================
// Server-action error logger.
//
// Several admin server actions catch failures and hand the user a friendly
// message — correct UX, but historically the caught error vanished: nothing
// in the logs, nothing in Sentry. `logActionError` is the one-liner those
// catch blocks call so the failure is observable without changing what the
// user sees.
//
//   try { ... } catch (err) {
//     logActionError('admin.orders.resend_confirmation', err, { order_id });
//     return { error: 'Failed to send email' };   // unchanged UX
//   }
//
// Emits a structured log line (src/lib/logger.ts patterns) AND captures to
// Sentry via @sentry/nextjs with the scope as a tag, so occurrences group
// per action and are searchable by `action_scope`.
// ============================================================================

import * as Sentry from '@sentry/nextjs';
import { log } from './logger';

export function logActionError(
  scope: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const error = err instanceof Error ? err : new Error(String(err));

  // Structured JSON line; the logger also mirrors errors to monitoring.
  log.error(`${scope}.action_failed`, { err: error, ...extra });

  // Direct Sentry capture with the scope tag. Without a configured DSN the
  // SDK no-ops, and we never let telemetry take down the action itself.
  try {
    Sentry.captureException(error, {
      tags: { action_scope: scope },
      extra,
    });
  } catch {
    /* Sentry unavailable — the log line above already landed. */
  }
}
