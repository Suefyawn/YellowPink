import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/admin') return NextResponse.next();

  if (pathname.startsWith('/admin/')) {
    const session = request.cookies.get('admin_session')?.value;
    const pass = process.env.ADMIN_PASSWORD ?? 'yellowpink2024';
    const expected = Buffer.from(pass).toString('base64');
    if (session !== expected) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
