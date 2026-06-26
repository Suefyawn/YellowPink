import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getStaffSession } from '@/lib/staff-auth';
import { buildConsentUrl, isGoogleOAuthConfigured } from '@/lib/google';
import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';

// Kicks off the "Connect Google" OAuth flow. Owner-only. Sets a short-lived
// state cookie (CSRF) that the callback verifies.
export async function GET() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return NextResponse.redirect(`${SITE_URL}/admin`);
  }
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(`${SITE_URL}/admin/settings/integrations?error=${encodeURIComponent('Google OAuth is not configured (set GOOGLE_OAUTH_CLIENT_ID/SECRET).')}`);
  }

  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(buildConsentUrl(state));
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  });
  return res;
}
