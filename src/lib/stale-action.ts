// Detects the Next.js "stale tab Server Action" failure: a page loaded
// before a deploy submits a form whose action ID was rehashed by the new
// build, so the server doesn't recognise it. Pre-deploy customers with an
// open tab hit this on their next submit. It's not a real bug, a reload
// fixes it instantly, so the error boundary treats it specially instead
// of rendering "Critical error" and emitting Sentry noise.
//
// Match on both name and message because Next.js wraps the underlying
// `UnrecognizedActionError` once the error reaches the client boundary
// and only the message survives in some build modes.
export function isStaleServerActionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; message?: unknown };
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';
  return (
    name === 'UnrecognizedActionError' ||
    /server action .* was not found on the server/i.test(message) ||
    /failed to find server action/i.test(message)
  );
}

// The sibling deploy-skew failure: a tab (or installed PWA) loaded before a
// deploy tries to fetch a hashed JS/CSS chunk that the new build renamed, so
// it 404s and React throws — "white screen no matter where I click". Like the
// Server Action case it's not a real bug; re-fetching the current build fixes
// it. Covers webpack's ChunkLoadError and the native dynamic-import failures
// modern bundlers surface.
export function isStaleBuildError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; message?: unknown };
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';
  const s = `${name} ${message}`.toLowerCase();
  return (
    s.includes('chunkloaderror') ||
    s.includes('loading chunk') ||
    s.includes('loading css chunk') ||
    s.includes('failed to fetch dynamically imported module') ||
    s.includes('error loading dynamically imported module') ||
    s.includes('importing a module script failed')
  );
}

// Either deploy-skew condition — a stale tab that a reload will heal.
export function isDeploySkewError(error: unknown): boolean {
  return isStaleServerActionError(error) || isStaleBuildError(error);
}

// Shared reload-once guard so an error boundary can hard-reload to pick up the
// current build without risking a reload loop when the *fresh* build also
// errors (i.e. it isn't really a stale cache). Timestamp-based so a genuinely
// later deploy-skew still heals. Returns true if it triggered a reload.
export function reloadOnceForDeploySkew(): boolean {
  if (typeof window === 'undefined') return false;
  const KEY = 'yp_deploy_skew_reload_at';
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* private mode */ }
  if (Date.now() - last <= 15_000) return false; // reloaded seconds ago → don't loop
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
  window.location.reload();
  return true;
}
