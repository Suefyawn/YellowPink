// Shared runner for the daily and weekly cron fan-outs. Each sub-job is a
// route handler under /api/cron/*; the fan-out used to re-fetch its own origin
// per job (a Vercel Hobby workaround for the two-cron limit). On Workers the
// handlers are imported and called in-process with the same request, so one
// scheduler call runs the whole day without a second hop through the edge.
//
// ponytail: a hung job is reported as timed out after `timeoutMs` but is not
// aborted (handlers take no signal); the run moves on. Add AbortSignal
// plumbing to a handler if one ever hangs for real.

import type { NextRequest } from 'next/server';

export interface SubJobResult {
  job: string;
  ok: boolean;
  status: number;
  ms: number;
  body?: unknown;
  error?: string;
}

export type CronHandler = (req: NextRequest) => Promise<Response>;

export async function runJobs(
  req: NextRequest,
  jobs: Array<[name: string, handler: CronHandler]>,
  timeoutMs: number,
): Promise<SubJobResult[]> {
  const results: SubJobResult[] = [];
  for (const [job, handler] of jobs) {
    const t0 = Date.now();
    try {
      const res = await Promise.race([
        handler(req),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)),
      ]);
      let body: unknown = null;
      try { body = await res.json(); } catch { /* non-JSON response */ }
      results.push({ job, ok: res.ok, status: res.status, ms: Date.now() - t0, body });
    } catch (err) {
      results.push({ job, ok: false, status: 0, ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
