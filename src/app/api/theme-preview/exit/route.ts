// Leave the storefront look preview: drop draft mode + the occasion cookie
// and go back to the Sales & occasions page. No auth needed — it only ever
// removes the caller's own preview state.

import { NextResponse, type NextRequest } from 'next/server';
import { draftMode } from 'next/headers';
import { LOOK_PREVIEW_COOKIE } from '@/lib/preview-look';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  (await draftMode()).disable();
  const res = NextResponse.redirect(new URL('/admin/sales', req.url));
  res.cookies.delete(LOOK_PREVIEW_COOKIE);
  return res;
}
