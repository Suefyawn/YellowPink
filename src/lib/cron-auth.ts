// One place for the cron gate. Every /api/cron/* handler (and the daily and
// weekly fan-outs) accepts only the shared CRON_SECRET as a bearer token and
// fails closed when it is unset. JOBS_DISABLED=1 (the staging Worker, and
// production while deployed dark, see wrangler.jsonc) refuses every job so a
// second deployment sharing the production database never double-runs the
// emails, courier polls and coupon windows.

export function cronAuthorized(req: Request): boolean {
  if (process.env.JOBS_DISABLED === '1') return false;
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}
