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
import { saleEventToSeasonalSettings, type SaleEvent } from '@/lib/sale-events';

export const LOOK_PREVIEW_COOKIE = 'look_preview';

export interface PreviewLook {
  key: string;
  name: string;
}

/** Site settings as the STOREFRONT should render them: the stored settings,
 *  overlaid with the previewed occasion when this request carries an active
 *  look preview. Only layout.tsx and the homepage use this — admin pages,
 *  emails and APIs keep reading the raw stored settings. */
export async function getStorefrontSettings(): Promise<{
  settings: Record<string, string>;
  preview: PreviewLook | null;
}> {
  const settings = await getSiteSettings();
  try {
    // draftMode() is static-rendering-safe: on cached renders it reports
    // disabled without touching the request, so only actual previewer
    // requests (bypass cookie present) go down the dynamic path below.
    const { isEnabled } = await draftMode();
    if (!isEnabled) return { settings, preview: null };
    const key = (await cookies()).get(LOOK_PREVIEW_COOKIE)?.value?.trim();
    if (!key) return { settings, preview: null };

    const { data } = await supabaseAdmin()
      .from('sale_events').select('*').eq('key', key).maybeSingle();
    if (!data) return { settings, preview: null };
    const event = data as SaleEvent;

    const { settings: overlay } = saleEventToSeasonalSettings(event, 'now');
    return {
      settings: { ...settings, ...overlay },
      preview: { key: event.key, name: event.name },
    };
  } catch {
    // Any preview hiccup must never break the storefront for real visitors.
    return { settings, preview: null };
  }
}
