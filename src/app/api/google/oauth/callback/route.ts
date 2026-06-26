import { type NextRequest, NextResponse } from 'next/server';
import { exchangeCodeAndStore, autoLinkProperties } from '@/lib/google';
import { SITE_URL } from '@/lib/seo';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';

const SETTINGS = `${SITE_URL}/admin/settings/integrations`;

// Return an HTML page that client-side navigates to `to`, instead of a 30x
// redirect. The admin's staff_session cookie is sameSite=strict, so the FIRST
// request after returning from accounts.google.com (a cross-site-initiated
// navigation) omits it, a server redirect would land on /admin looking like a
// logout. This static page carries no auth; the location.replace it runs is a
// same-site navigation, so the strict cookie IS sent and the session survives.
function htmlRedirect(to: string, clearState: boolean): NextResponse {
  const res = new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">` +
    `<meta http-equiv="refresh" content="0;url=${to.replace(/"/g, '&quot;')}">` +
    `<title>Returning…</title>` +
    `<body style="font-family:system-ui,sans-serif;padding:48px;text-align:center;color:#374151">` +
    `Connected, returning to your dashboard…` +
    `<script>location.replace(${JSON.stringify(to)})</script></body>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
  if (clearState) res.cookies.delete('g_oauth_state');
  return res;
}

// OAuth redirect target. We do NOT re-check the staff session here: this is a
// cross-site navigation back from accounts.google.com and the staff_session
// cookie (sameSite=strict) isn't sent. CSRF/auth is enforced by the random
// `g_oauth_state` cookie set by the staff-gated /start route.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const oauthError = url.searchParams.get('error');
  if (oauthError) return htmlRedirect(`${SETTINGS}?error=${encodeURIComponent(`Google: ${oauthError}`)}`, true);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = req.cookies.get('g_oauth_state')?.value;
  if (!code || !state || !expected || state !== expected) {
    return htmlRedirect(`${SETTINGS}?error=${encodeURIComponent('Google sign-in could not be verified. Please try again.')}`, true);
  }

  try {
    await exchangeCodeAndStore(code);
    await autoLinkProperties();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('google.oauth_callback_failed', { error: msg });
    const friendly = msg === 'no_refresh_token'
      ? 'Google didn’t return a refresh token. In your Google account, remove Yellow Pink’s access and connect again.'
      : 'Connecting Google failed. Please try again.';
    return htmlRedirect(`${SETTINGS}?error=${encodeURIComponent(friendly)}`, true);
  }

  return htmlRedirect(`${SETTINGS}?google=connected`, true);
}
