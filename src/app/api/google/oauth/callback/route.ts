import { type NextRequest, NextResponse } from 'next/server';
import { exchangeCodeAndStore, autoLinkProperties } from '@/lib/google';
import { SITE_URL } from '@/lib/seo';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';

const SETTINGS = `${SITE_URL}/admin/settings/integrations`;

// OAuth redirect target. We do NOT re-check the staff session here: this is a
// cross-site navigation back from accounts.google.com, and the staff_session
// cookie is sameSite=strict so it isn't sent on that request (re-checking it
// would always fail and bounce the owner to /admin — looking like a logout).
// CSRF/auth is enforced by the random `g_oauth_state` cookie set in /start
// (which IS staff-gated); only a flow that began there has the matching state.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const error = url.searchParams.get('error');
  if (error) return NextResponse.redirect(`${SETTINGS}?error=${encodeURIComponent(`Google: ${error}`)}`);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = req.cookies.get('g_oauth_state')?.value;
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(`${SETTINGS}?error=${encodeURIComponent('Google sign-in could not be verified. Please try again.')}`);
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
    return NextResponse.redirect(`${SETTINGS}?error=${encodeURIComponent(friendly)}`);
  }

  const res = NextResponse.redirect(`${SETTINGS}?google=connected`);
  res.cookies.delete('g_oauth_state');
  return res;
}
