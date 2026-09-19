// ============================================================================
// Sentry primitives the rest of the codebase calls without caring which SDK
// initialised the client: @sentry/nextjs on Vercel and in `next dev`,
// @sentry/cloudflare on Workers (src/worker.ts wraps the fetch handler).
// Both bind their client to the scope @sentry/core reads, so this module
// needs no runtime branch. Without SENTRY_DSN neither SDK initialises and
// captureException() is a no-op, which is when we log to the console instead.
// ============================================================================

import * as Sentry from '@sentry/core';

type ErrorContext = Record<string, unknown>;

const enabled = () => Boolean(process.env.SENTRY_DSN);

export async function captureError(err: unknown, extra?: ErrorContext): Promise<void> {
  if (enabled()) Sentry.captureException(err, { extra });
  else if (process.env.NODE_ENV !== 'production') {
    console.error('[monitoring]', err, extra);
  }
}

export async function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
  if (enabled()) Sentry.captureMessage(msg, level);
  else if (process.env.NODE_ENV !== 'production') {
    console.log(`[monitoring:${level}]`, msg);
  }
}
