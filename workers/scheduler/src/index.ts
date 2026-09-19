/**
 * Scheduler Worker: turns Cron Triggers into calls on the site (service binding SITE). It holds no logic of its
 * own; every job lives in the site's /api/cron/* handlers, this only decides when. Secret: CRON_SECRET (the same
 * value as the site's).
 *
 *   09:00 UTC daily      /api/cron/daily          (abandoned carts, courier sync, order nudges, coupons, popularity, reviews, stuck payments, 404 digest, analytics)
 *   09:30 UTC daily      /api/cron/indexing-check (Search Console index status, a long I/O loop)
 *   10:00 UTC Mondays    /api/cron/weekly         (price parity, weekly report)
 *   every 10 minutes     /api/cron/abandoned-cart-bells (admin bell for carts past the grace period, was pg_cron)
 */
type Env = {
  SITE: { fetch: (input: string | Request, init?: RequestInit) => Promise<Response> };
  SITE_URL: string;
  CRON_SECRET: string;
};
type Ctx = { waitUntil(p: Promise<unknown>): void };

const JOBS: Record<string, string> = {
  '0 9 * * *': '/api/cron/daily',
  '30 9 * * *': '/api/cron/indexing-check',
  '0 10 * * 1': '/api/cron/weekly',
  '*/10 * * * *': '/api/cron/abandoned-cart-bells',
};

async function site(env: Env, path: string): Promise<{ status: number; body: unknown }> {
  const res = await env.SITE.fetch(`${env.SITE_URL}${path}`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return { status: res.status, body };
}

async function runCron(cron: string, env: Env) {
  const path = JOBS[cron];
  if (!path) return { status: 204, body: { ignored: cron } };
  return site(env, path);
}

const worker = {
  async scheduled(event: { cron: string }, env: Env, ctx: Ctx) {
    ctx.waitUntil(
      runCron(event.cron, env)
        .then((r) => console.log(JSON.stringify({ cron: event.cron, ...r })))
        .catch((e) => console.error(JSON.stringify({ cron: event.cron, error: (e as Error).message }))),
    );
  },
  /** Manual trigger for checks: POST /run/<cron expression or job path> with the CRON_SECRET. */
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (url.pathname === '/') return new Response('yellowpink-scheduler', { headers: { 'content-type': 'text/plain' } });
    if (req.method === 'POST' && url.pathname.startsWith('/run/')) {
      if (req.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) return new Response('unauthorized', { status: 401 });
      const key = decodeURIComponent(url.pathname.slice(5));
      const cron = key.startsWith('/') ? Object.keys(JOBS).find((c) => JOBS[c] === key) ?? key : key;
      try {
        return Response.json({ ok: true, cron, ...(await runCron(cron, env)) });
      } catch (e) {
        return Response.json({ ok: false, cron, error: (e as Error).message }, { status: 502 });
      }
    }
    return new Response('not found', { status: 404 });
  },
};
export default worker;
