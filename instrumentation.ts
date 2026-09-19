// Vercel / next dev: initialise the Next Sentry SDK. On Workers the platform
// module makes this a no-op and src/worker.ts wraps the fetch handler with
// @sentry/cloudflare instead. Next also compiles this file for its edge
// runtime; NEXT_RUNTIME is inlined at build time, so the early return keeps
// the platform module (and its Node imports) out of that bundle entirely.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  const { initServerMonitoring } = await import('@/lib/platform');
  await initServerMonitoring();
}
