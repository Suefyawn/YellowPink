import 'server-only';

// Storefront look preview (Sales & occasions → "Preview"). Lets staff see the
// real site wearing an occasion's saved look BEFORE publishing it, Shopify
// theme-preview style. Mechanism: Next draft mode (the __prerender_bypass
// cookie makes the previewer's requests skip the ISR cache and render
// dynamically) plus a `look_preview` cookie naming the occasion. For that one
// browser the seasonal settings are overlaid with the occasion's saved
// fields; every other visitor keeps the cached, published site.

import { draftMode, cookies } from 'next/headers';
import { getSiteSettings, supabaseAdmin } from '@/lib/supabase';
import {
  saleEventToSeasonalSettings, pickAutoEvent, autoSnoozed,
  explicitLookConfigured, type SaleEvent,
} from '@/lib/sale-events';

export const LOOK_PREVIEW_COOKIE = 'look_preview';

export interface PreviewLook {
  key: string;
  name: string;
}

/** Site settings as the STOREFRONT should render them, in priority order:
 *  1. a staff look preview (draft-mode request) wins outright;
 *  2. an explicit owner choice (manual switch / armed schedule) as stored;
 *  3. the occasions autopilot — the calendar event whose window is open (or
 *     opens within a day) is overlaid as an armed schedule, so the client
 *     clock still flips it exactly on time. `auto` names that occasion.
 *  Only layout.tsx, the homepage and the Sales admin page use this — emails
 *  and APIs keep reading the raw stored settings. */
export async function getStorefrontSettings(): Promise<{
  settings: Record<string, string>;
  preview: PreviewLook | null;
  auto: PreviewLook | null;
}> {
  const settings = await getSiteSettings();

  // 1. Staff preview. draftMode() is static-rendering-safe: on cached renders
  // it reports disabled without touching the request, so only actual
  // previewer requests (bypass cookie present) go down this dynamic path.
  try {
    const { isEnabled } = await draftMode();
    if (isEnabled) {
      const key = (await cookies()).get(LOOK_PREVIEW_COOKIE)?.value?.trim();
      if (key) {
        const { data } = await supabaseAdmin()
          .from('sale_events').select('*').eq('key', key).maybeSingle();
        if (data) {
          const event = data as SaleEvent;
          const { settings: overlay } = saleEventToSeasonalSettings(event, 'now');
          return {
            settings: { ...settings, ...overlay },
            preview: { key: event.key, name: event.name },
            auto: null,
          };
        }
      }
    }
  } catch {
    /* a preview hiccup must never break the storefront for real visitors */
  }

  // 2. Explicit owner choice — stored settings stand as they are.
  if (explicitLookConfigured(settings)) return { settings, preview: null, auto: null };

  // 3. Autopilot.
  try {
    const { data } = await supabaseAdmin().from('sale_events').select('*');
    const events = (data ?? []) as SaleEvent[];
    const event = pickAutoEvent(events);
    if (!event || autoSnoozed(event, settings)) return { settings, preview: null, auto: null };
    const { settings: overlay, error } = saleEventToSeasonalSettings(event, 'schedule');
    if (error) return { settings, preview: null, auto: null };
    // Keep the stored snooze visible to the resolver chain (the overlay
    // clears it, but nothing is written back — this is per-render only).
    return {
      settings: { ...settings, ...overlay, season_auto_snooze: settings.season_auto_snooze ?? '' },
      preview: null,
      auto: { key: event.key, name: event.name },
    };
  } catch {
    return { settings, preview: null, auto: null };
  }
}
