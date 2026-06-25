import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/seo';

// Landing route for Supabase email links (customer "Confirm signup" and the
// doctor magic-link sign-in). Supabase verifies the emailed token, then
// redirects here with a PKCE `code`. We exchange it for a session server-side
// — which sets the auth cookies — so the visitor lands already signed in, with
// no client-side session race.
//
// `?next=` lets a flow pick where to land (must be a same-origin path). The
// doctor portal passes next=/reviewer; customers default to /account.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const nextParam = request.nextUrl.searchParams.get('next');
  // Only honour same-origin absolute paths (reject protocol-relative `//host`).
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/account';
  const signIn = next.startsWith('/reviewer') ? '/reviewer/login' : '/login';

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${SITE_URL}${next}`);
    }
  }

  // No code, or an expired / already-used link — send them to sign in.
  return NextResponse.redirect(`${SITE_URL}${signIn}`);
}
