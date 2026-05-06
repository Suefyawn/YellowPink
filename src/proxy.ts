import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin auth
  if (pathname === '/admin') return NextResponse.next();
  if (pathname.startsWith('/admin/')) {
    const session = request.cookies.get('admin_session')?.value;
    const pass = process.env.ADMIN_PASSWORD;
    if (!pass) {
      // ADMIN_PASSWORD env var not set — block all access
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    const expected = Buffer.from(pass).toString('base64');
    if (session !== expected) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // Account auth — check for Supabase session cookie presence
  if (pathname.startsWith('/account')) {
    const hasSession = [...request.cookies.getAll()].some(c =>
      c.name.includes('auth-token') || c.name.includes('sb-') && c.name.endsWith('-auth-token')
    );
    if (!hasSession) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/account', '/account/:path*'],
};
