// When a live product's or collection's slug changes, the old URL is out in
// the world — search results, shared WhatsApp links, blog posts. Shopify keeps
// the old handle working; we do the same by writing a 301 into the redirects
// table the middleware already consults (migration 012). Best-effort: a
// failure here must never block the rename itself.

import { supabaseAdmin } from '@/lib/supabase';
import { log } from '@/lib/logger';

export async function recordSlugRedirect(
  kind: 'product' | 'collection',
  oldSlug: string | null | undefined,
  newSlug: string,
): Promise<void> {
  if (!oldSlug || !newSlug || oldSlug === newSlug) return;
  const from = `/${kind}/${oldSlug}`;
  const to = `/${kind}/${newSlug}`;
  try {
    const admin = supabaseAdmin();
    // A rename back (A→B then B→A) must not leave a loop: drop any rule whose
    // source is the address that just became live again.
    await admin.from('redirects').delete().eq('from_path', to);
    await admin.from('redirects').upsert(
      { from_path: from, to_path: to, status_code: 301, source: 'admin' },
      { onConflict: 'from_path' },
    );
    // Re-point older rules that still target the old address, so a second
    // rename doesn't leave a redirect chain.
    await admin.from('redirects').update({ to_path: to }).eq('to_path', from).neq('from_path', to);
  } catch (err) {
    log.error('slug_redirect_failed', { kind, oldSlug, newSlug, error: err instanceof Error ? err.message : String(err) });
  }
}
