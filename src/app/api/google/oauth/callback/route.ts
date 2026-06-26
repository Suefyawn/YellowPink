import { type NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/staff-auth';
import { exchangeCodeAndStore, autoLinkProperties } from '@/lib/google';
import { SITE_URL } from '@/lib/seo';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';

const SETTINGS = `${SITE_URL}/admin/settings/integrations`;

// OAuth redirect target. Verifies state + staff session, stores the refresh
// token, and auto-links the GSC site + GA4 property.
export async function GET(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return NextResponse.redirect(`${SITE_URL}/admin`);
  }

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
