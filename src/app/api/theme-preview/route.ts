// Enter a storefront look preview (staff only). Linked from the Preview
// buttons on Admin → Sales & occasions; enables draft mode + remembers which
// occasion to overlay, then lands on the homepage wearing that look.
// See src/lib/preview-look.ts for how the overlay is applied.

import { NextResponse, type NextRequest } from 'next/server';
import { draftMode } from 'next/headers';
import { getStaffSession } from '@/lib/staff-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { LOOK_PREVIEW_COOKIE } from '@/lib/preview-look';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  const key = (new URL(req.url).searchParams.get('key') ?? '').trim();
  const { data } = key
    ? await supabaseAdmin().from('sale_events').select('key').eq('key', key).maybeSingle()
    : { data: null };
  if (!data) {
    return NextResponse.redirect(new URL('/admin/sales?error=Occasion%20not%20found.', req.url));
  }

  (await draftMode()).enable();
  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(LOOK_PREVIEW_COOKIE, key, { httpOnly: true, sameSite: 'lax', path: '/' });
  return res;
}
