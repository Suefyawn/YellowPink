// Internal WhatsApp redirect + click log.
//
// Storefront "Chat / Order on WhatsApp" buttons link here instead of straight
// to wa.me. Two wins:
//   1. SEO: /go/ is Disallowed in robots.txt, so crawlers stop at our domain
//      and never probe wa.me — killing the "669 broken external links" (all the
//      same wa.me number, 429-rate-limited by WhatsApp against the crawler).
//   2. Analytics: we log each click, so WhatsApp-order intent becomes a
//      measurable funnel step (Analytics → Sources), not a blind spot.
//
// Best-effort throughout: a failed log never blocks the redirect; a missing
// number falls back to the contact page instead of a dead wa.me link.

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { merchantNumber } from '@/lib/whatsapp';
import { getSiteSettings } from '@/lib/supabase';
import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';

/** Normalise any stored value (bare number, wa.me URL, "0300…", "+92…") to
 *  E.164 digits without the leading +. Returns null when unusable. */
function normalizeNumber(v: string | null | undefined): string | null {
  if (!v) return null;
  let digits = v.replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = '92' + digits.slice(1);
  return digits;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const text = (sp.get('text') ?? '').slice(0, 600);
  const src = (sp.get('src') ?? '').slice(0, 40) || null;
  const productSlug = (sp.get('p') ?? '').slice(0, 120) || null;

  // Resolve the merchant number the same way the storefront does: build-time env
  // first, then the admin settings (store_whatsapp / store_phone / the social
  // WhatsApp URL). Keeps this route in sync with whichever the buttons use.
  let number = merchantNumber();
  if (!number) {
    try {
      const s = await getSiteSettings();
      number =
        normalizeNumber(s.store_whatsapp) ??
        normalizeNumber(s.store_phone) ??
        normalizeNumber(s.social_whatsapp);
    } catch {
      /* settings unreachable — fall through to contact page */
    }
  }

  const dest = number
    ? `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
    : `${SITE_URL}/page/contact`;

  // Log the click after the response so it never delays the redirect.
  try {
    after(async () => {
      try {
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } },
        );
        const referer = req.headers.get('referer');
        let path: string | null = null;
        if (referer) { try { path = new URL(referer).pathname.slice(0, 200); } catch { /* ignore */ } }
        await admin.from('whatsapp_clicks').insert({ src, path, product_slug: productSlug });
      } catch { /* best-effort: a failed log must not matter */ }
    });
  } catch { /* no request scope (shouldn't happen in a route handler) */ }

  return NextResponse.redirect(dest, {
    status: 302,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
