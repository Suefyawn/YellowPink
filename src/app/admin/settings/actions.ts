'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { isValidEmv } from '@/lib/payments/emv-qr';

// Settings is a grantable permission ('settings' — see lib/permissions.ts),
// and every other settings surface (the settings layout, integrations,
// emails, broken-links, indexing) gates on owner-or-settings. This action
// used to demand isOwner, so a staffer the model says can manage settings
// crashed with an unhandled "Unauthorized" on every save. Align it.
async function assertSettings() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// Server-side validation for the settings the sub-page forms expose. The
// forms only guard on the client, so a crafted post (or a JS-off browser)
// could persist a negative rate or a bad colour under a success banner.
function validateSettings(pairs: { key: string; value: string }[]): string | null {
  const isHex = (v: string) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
  const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());
  for (const { key, value } of pairs) {
    if (value === '') continue; // clearing a setting is allowed
    // Colour keys (branding): brand_color, *_color, *_colour.
    if (/(?:^|_)colou?r$/.test(key) && !isHex(value)) {
      return `${key} must be a hex colour like #RRGGBB`;
    }
    // Numeric keys: rates, thresholds, points, percentages, durations.
    if (/(rate|threshold|amount|price|points|percent|pct|days|minutes|limit|per_pkr|qty)/.test(key)) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return `${key} must be a number of zero or more`;
    }
    if (/email$/.test(key) && !isEmail(value)) return `${key} must be a valid email address`;
    // The scan-to-pay code carries its own checksum. Refusing a bad paste here
    // means the owner is told at the point of saving, rather than the method
    // silently never appearing at checkout.
    if (key === 'pay_jazzcash_qr' && !isValidEmv(value)) {
      return 'The QR content is not a readable payment code (its checksum does not match). Copy it again from your QR.';
    }
  }
  return null;
}

export async function saveSettings(formData: FormData): Promise<void> {
  const session = await assertSettings();

  // Deduplicate: last value wins, so checkbox "true" overrides hidden "false".
  // Also drop any key starting with '$', those are Next.js server-action
  // binding inputs ($ACTION_ID_…, $ACTION_REF_…, etc.) that should never
  // end up in the site_settings table (audit SEV-2). The DB now also has
  // a CHECK constraint refusing these keys; this is belt-and-braces.
  // `_redirect` is a meta field the sub-page sets so the action returns the
  // owner to the page they submitted from, not always `/admin/settings`.
  const map = new Map<string, string>();
  let redirectTarget = '/admin/settings';
  for (const [key, val] of formData.entries()) {
    if (typeof val !== 'string') continue;
    if (key.startsWith('$')) continue;
    if (key === '_redirect') {
      // Only allow paths under /admin/settings to prevent open-redirect.
      if (val.startsWith('/admin/settings')) redirectTarget = val;
      continue;
    }
    map.set(key, val);
  }

  const pairs = Array.from(map.entries()).map(([key, value]) => ({ key, value }));

  const invalid = validateSettings(pairs);
  if (invalid) {
    redirect(`${redirectTarget}?error=${encodeURIComponent(invalid)}`);
  }

  if (pairs.length) {
    // site_settings RLS allows public SELECT only; writes must go through
    // the service-role client (this action is owner-gated above).
    const { error } = await supabaseAdmin().from('site_settings').upsert(pairs, { onConflict: 'key' });
    if (error) {
      redirect(`${redirectTarget}?error=${encodeURIComponent(error.message)}`);
    }
  }

  void logAudit(session, {
    action: 'settings.save',
    entity: 'site_settings',
    diff: { keys_updated: pairs.map(p => p.key) },
  });

  revalidatePath('/', 'layout');
  // Explicit page-level revalidation of the homepage too, the sale toggle
  // and other settings drive homepage sections, and the layout-level call
  // alone has been unreliable at refreshing the index render.
  revalidatePath('/', 'page');
  revalidatePath(redirectTarget);
  redirect(`${redirectTarget}?saved=1`);
}

// The Branding page's seasonal-theme card (saveSeasonalTheme) was retired on
// 1 Sep 2026: all seasonal control lives in Admin → Sales & occasions, whose
// actions write the same settings keys with the source occasion recorded.
// applySeasonalModeMapping in lib/seasonal-theme.ts documents the key mapping.
