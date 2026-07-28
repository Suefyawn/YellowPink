// ============================================================================
// Weekly Vercel Cron (Mondays 10:00 UTC = 3 pm PKT) — the two Monday-only
// jobs: NB Sons price-parity and the owner's weekly health report.
//
// These used to run as the last two jobs of the daily fanout, positioned
// there as "safest to skip" when the 60 s budget ran short. In practice the
// eight jobs ahead of them ate the whole budget EVERY Monday (observed 27
// July: abandoned-cart ran at 09:39, indexing-check was still burning budget
// at the wall, and neither Monday job was ever invoked), so "occasionally
// skipped" was actually "never runs". Vercel Hobby allows two cron entries;
// this is the second, so the Monday jobs get a fresh 60 s of their own.
//
// Both routes keep their own Monday self-gate (this cron only fires Mondays,
// but a manual weekday hit with the secret shouldn't fire them off-schedule).
// Same delegation pattern + per-job deadline as /api/cron/daily.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

interface SubJobResult {
  job: string;
  ok: boolean;
  status: number;
  ms: number;
  body?: unknown;
  error?: string;
}

async function runJob(req: NextRequest, path: string, timeoutMs: number): Promise<SubJobResult> {
  const t0 = Date.now();
  try {
    const url = new URL(path, req.url);
    const res = await fetch(url, {
      method: 'GET',
      headers: { authorization: req.headers.get('authorization') ?? '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON response */ }
    return { job: path, ok: res.ok, status: res.status, ms: Date.now() - t0, body };
  } catch (err) {
    const aborted = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      job: path, ok: false, status: 0, ms: Date.now() - t0,
      error: aborted ? `timed out after ${timeoutMs}ms` : err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Parity first (it scrapes the vendor store and is the slower of the two);
  // the report second — it summarizes the week and tolerates a late start.
  const JOBS = ['/api/cron/price-parity', '/api/cron/weekly-report'];
  const BUDGET_MS = (maxDuration - 10) * 1000;
  const started = Date.now();
  const results: SubJobResult[] = [];
  for (const path of JOBS) {
    const remaining = BUDGET_MS - (Date.now() - started);
    if (remaining <= 0) {
      results.push({ job: path, ok: false, status: 0, ms: 0, error: 'skipped: cron time budget exhausted' });
      continue;
    }
    results.push(await runJob(req, path, Math.min(remaining, 30_000)));
  }

  const allOk = results.every(r => r.ok);
  console.log('[cron/weekly]', JSON.stringify(results.map(r => ({ job: r.job, ok: r.ok, ms: r.ms, error: r.error }))));
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 });
}
