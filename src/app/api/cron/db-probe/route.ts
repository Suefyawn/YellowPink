// Database probe cron: every 15 minutes, can the store read its database?
//
// The 17-18 Sep 2026 outage (Supabase plan restriction, two days of demo
// products) was invisible to every page-level monitor because pages kept
// returning 200. This job is the store watching itself: one trivial read,
// and if it fails the owner gets an email through Resend, a path that needs
// nothing from the database. A Sentry uptime monitor on /api/health/db would
// do the same from outside, but the Sentry plan has no uptime seat, so the
// monitor exists disabled and this cron carries the duty.
//
// Throttle: Resend's own sent-mail log is the state store (the database is
// the thing that is down). One outage email per six hours while it persists,
// then one recovery email when the read succeeds again after an alert.

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { supabase, isDemo } from '@/lib/supabase';
import { isSupabaseRestricted } from '@/lib/supabase-resilience';
import {
  sendDatabaseOutageAlertEmail,
  sendDatabaseRecoveredEmail,
  lastDatabaseAlertSentAt,
} from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALERT_EVERY_MS = 6 * 60 * 60 * 1000;

/** True in the first quarter-hour of 00:00, 06:00, 12:00 and 18:00 UTC, the
 *  four runs a day that may mail when the throttle has no memory. */
function isSixHourMark(now: Date): boolean {
  return now.getUTCHours() % 6 === 0 && now.getUTCMinutes() < 15;
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (isDemo) return NextResponse.json({ ok: true, demo: true });

  let failure: string | null = null;
  try {
    const { error } = await supabase.from('site_settings').select('key').limit(1);
    if (error) throw error;
  } catch (err) {
    failure = err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err);
  }

  // Resend is the only memory this job has. `last` is when the most recent
  // outage or recovery mail went out and which it was.
  const last = await lastDatabaseAlertSentAt();

  if (failure === null) {
    // Healthy. If the last thing we said was "down", say "up" once.
    if (last !== 'unknown' && last?.kind === 'outage') {
      await sendDatabaseRecoveredEmail({ source: 'database probe', downSince: last.at });
    }
    return NextResponse.json({ ok: true });
  }

  const restricted = isSupabaseRestricted({ message: failure });
  const dueForAlert = last === 'unknown'
    // No memory at all (Resend's log unreadable): mail on the six-hour marks
    // only, so a day-long outage costs four mails, never ninety-six.
    ? isSixHourMark(new Date())
    : !last || last.kind === 'recovered' || Date.now() - last.at.getTime() >= ALERT_EVERY_MS;
  if (dueForAlert) {
    await sendDatabaseOutageAlertEmail({
      source: 'database probe',
      restricted,
      failures: [{ job: 'db-probe', detail: failure }],
    });
  }
  try {
    Sentry.captureMessage('db-probe: database unreachable', {
      level: 'fatal',
      fingerprint: restricted ? ['supabase-restricted'] : ['db-probe-failed'],
      extra: { failure, emailed: dueForAlert },
    });
  } catch { /* telemetry must not fail the run */ }

  return NextResponse.json({ ok: false, restricted, emailed: dueForAlert, reason: failure }, { status: 503 });
}
