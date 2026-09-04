'use server';

// Sales & occasions: one-click activation of a saved sale "version".
// Activation copies the event's fields into the seasonal-theme settings keys
// (the exact keys Branding writes), so the storefront pipeline is unchanged
// and Branding remains the manual override for anything ad-hoc.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { normalizeTheme } from '@/lib/themes';
import {
  saleEventToSeasonalSettings, seasonOffSettings, eventActivationState,
  pickAutoEvent, autoSnoozeValue,
  type ActivationMode, type SaleEvent, type SaleEventCouponType,
} from '@/lib/sale-events';
import { ensureSaleEventCoupon, retireSaleEventCoupon, type CouponSyncResult } from '@/lib/sale-event-coupons';

/** Banner suffix describing what happened to the occasion's coupon. */
function couponNote(r: CouponSyncResult): string {
  if (r.action === 'created') return `; coupon ${r.code} created`;
  if (r.action === 'updated') return `; coupon ${r.code} ${r.detail.startsWith('coupon deactivated') ? 'switched off' : 'updated'}`;
  if (r.action === 'error') return `; coupon ${r.code ?? ''} could not be written (${r.detail})`;
  return r.code ? `; coupon ${r.code} skipped (${r.detail})` : '';
}

const PATH = '/admin/sales';
// Same gate as the Branding card, activating a sale IS a branding change.
const assertSales = () => assertPermission('settings');

async function writeSettings(settings: Record<string, string>): Promise<string | null> {
  const pairs = Object.entries(settings).map(([key, value]) => ({ key, value }));
  const { error } = await supabaseAdmin().from('site_settings').upsert(pairs, { onConflict: 'key' });
  return error ? error.message : null;
}

function bustStorefront() {
  revalidatePath('/', 'layout');
  revalidatePath('/', 'page');
  revalidatePath(PATH);
}

async function loadEvent(id: string): Promise<SaleEvent | null> {
  const { data } = await supabaseAdmin().from('sale_events').select('*').eq('id', id).single();
  return (data ?? null) as SaleEvent | null;
}

async function activate(formData: FormData, mode: ActivationMode): Promise<void> {
  const session = await assertSales();
  const id = (formData.get('id') as string) ?? '';
  const event = id ? await loadEvent(id) : null;
  if (!event) redirect(`${PATH}?error=${encodeURIComponent('Sale event not found.')}`);

  const { settings, error } = saleEventToSeasonalSettings(event, mode);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error)}`);

  const dbError = await writeSettings(settings);
  if (dbError) redirect(`${PATH}?error=${encodeURIComponent(dbError)}`);

  // The look and its discount publish together: the bar advertises the code,
  // so the code must exist and be valid for exactly that window.
  const coupon = await ensureSaleEventCoupon(event, mode);

  void logAudit(session, {
    action: mode === 'now' ? 'sale_event.activate' : 'sale_event.schedule',
    entity: 'sale_events',
    entity_id: event.id,
    diff: { key: event.key, theme: event.theme, mode, coupon: coupon.code, coupon_action: coupon.action },
  });
  bustStorefront();
  redirect(`${PATH}?saved=${encodeURIComponent((mode === 'now'
    ? `${event.name} is live on the storefront`
    : `${event.name} scheduled ${event.starts_on} to ${event.ends_on}`) + couponNote(coupon))}`);
}

export async function activateSaleEventNow(formData: FormData): Promise<void> {
  await activate(formData, 'now');
}

export async function scheduleSaleEvent(formData: FormData): Promise<void> {
  await activate(formData, 'schedule');
}

/** One switch back to the year-round look (clears manual AND scheduled).
 *  If the autopilot has an occasion running, its current window is snoozed
 *  too — otherwise the calendar would put the look straight back. The NEXT
 *  occasion still runs by itself. */
export async function turnOffSeason(): Promise<void> {
  const session = await assertSales();
  const off = seasonOffSettings();

  const { data } = await supabaseAdmin().from('sale_events').select('*');
  const events = (data ?? []) as SaleEvent[];
  const autoEvent = pickAutoEvent(events);
  if (autoEvent) off.season_auto_snooze = autoSnoozeValue(autoEvent);

  // Whichever occasion was wearing the crown (manual, scheduled or the
  // calendar) loses its coupon too: an advertised code must not outlive the
  // sale. Only codes the occasions page created/adopted are touched.
  const settingsNow = await getSiteSettings();
  const sourceKey = (settingsNow.seasonal_source_event ?? '').trim();
  const sourceEvent = events.find(e => e.key === sourceKey) ?? autoEvent;
  const coupon = sourceEvent ? await retireSaleEventCoupon(sourceEvent) : null;

  const dbError = await writeSettings(off);
  if (dbError) redirect(`${PATH}?error=${encodeURIComponent(dbError)}`);
  void logAudit(session, { action: 'sale_event.off', entity: 'sale_events', diff: { snoozed: autoEvent?.key ?? null, coupon: coupon?.code ?? null, coupon_action: coupon?.action ?? null } });
  bustStorefront();
  redirect(`${PATH}?saved=${encodeURIComponent((autoEvent
    ? `Seasonal look switched off — ${autoEvent.name}'s current window is skipped; the calendar resumes with the next occasion`
    : 'Seasonal look switched off, the store is back to the year-round theme') + (coupon ? couponNote(coupon) : ''))}`);
}

/** Save edits to one event's copy, coupon, theme or this year's dates. */
export async function saveSaleEvent(formData: FormData): Promise<void> {
  const session = await assertSales();
  const id = (formData.get('id') as string) ?? '';
  if (!id) redirect(`${PATH}?error=${encodeURIComponent('Missing event id.')}`);

  const text = (k: string, max = 500): string | null => {
    const v = ((formData.get(k) as string) ?? '').trim();
    return v ? v.slice(0, max) : null;
  };
  const date = (k: string): string | null => {
    const v = ((formData.get(k) as string) ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };

  const theme = normalizeTheme(text('theme') ?? '');
  if (theme === 'default') redirect(`${PATH}?error=${encodeURIComponent('Pick a seasonal theme for the event.')}`);

  const starts = date('starts_on');
  const ends = date('ends_on');
  if ((starts && ends) && ends < starts) {
    redirect(`${PATH}?error=${encodeURIComponent('The end date must be on or after the start date.')}`);
  }

  // Coupon settings travel with the look (migration 1330).
  const couponTypeRaw = text('coupon_type') ?? 'percent';
  const coupon_type: SaleEventCouponType =
    couponTypeRaw === 'fixed' || couponTypeRaw === 'free_shipping' ? couponTypeRaw : 'percent';
  const num = (k: string, fallback: number): number => {
    const v = Number(((formData.get(k) as string) ?? '').trim());
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  const optInt = (k: string): number | null => {
    const v = Math.floor(Number(((formData.get(k) as string) ?? '').trim()));
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const coupon_value = num('coupon_value', 10);
  if (coupon_type === 'percent' && coupon_value > 100) {
    redirect(`${PATH}?error=${encodeURIComponent('A percentage discount cannot exceed 100%.')}`);
  }
  const bar_coupon = text('bar_coupon', 40)?.toUpperCase() ?? null;
  if (bar_coupon && !/^[A-Z0-9_-]+$/.test(bar_coupon)) {
    redirect(`${PATH}?error=${encodeURIComponent('The coupon code may only contain letters, numbers, - and _.')}`);
  }

  const patch = {
    theme,
    starts_on: starts,
    ends_on: ends,
    bar_message: text('bar_message', 160),
    bar_coupon,
    coupon_type,
    coupon_value,
    coupon_min_order: num('coupon_min_order', 0),
    coupon_max_uses: optInt('coupon_max_uses'),
    coupon_per_user: optInt('coupon_per_user'),
    coupon_exclude_sale_items: formData.get('coupon_exclude_sale_items') === 'on',
    hero_overline: text('hero_overline', 80),
    hero_headline: text('hero_headline', 200)?.replace(/\n/g, '<br/>') ?? null,
    hero_subline: text('hero_subline', 400),
    hero_cta1_text: text('hero_cta1_text', 40),
    hero_cta1_url: text('hero_cta1_url', 300),
    hero_image_url: text('hero_image_url', 500),
    notes: text('notes', 500),
    auto_schedule: formData.get('auto_schedule') === 'on',
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin().from('sale_events').update(patch).eq('id', id);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);

  void logAudit(session, { action: 'sale_event.update', entity: 'sale_events', entity_id: id, diff: { theme, starts_on: starts, ends_on: ends } });

  // The storefront follows the library: if this occasion is the one currently
  // live (or armed), re-apply its freshly saved fields so the site never shows
  // a stale copy of an event the owner just edited.
  const updated = await loadEvent(id);
  const settingsNow = await getSiteSettings();
  const state = updated ? eventActivationState(updated, settingsNow) : null;
  if (updated && state) {
    const mode: ActivationMode = state === 'live' ? 'now' : 'schedule';
    const { settings, error: mapError } = saleEventToSeasonalSettings(updated, mode);
    // A schedule whose dates were just removed can't stay armed — fall back
    // to off rather than leaving half-written settings behind.
    const dbError = await writeSettings(mapError ? seasonOffSettings() : settings);
    if (dbError) redirect(`${PATH}?error=${encodeURIComponent(dbError)}`);
    // Live/armed occasion: its coupon follows the edit too (new value, new
    // window, or a new code), so the bar never advertises stale terms.
    const coupon = mapError ? null : await ensureSaleEventCoupon(updated, mode);
    bustStorefront();
    redirect(`${PATH}?saved=${encodeURIComponent(mapError
      ? 'Event saved. Its schedule was switched off because the dates were removed.'
      : `Event saved and the ${state === 'live' ? 'live look' : 'scheduled look'} updated with it` + (coupon ? couponNote(coupon) : ''))}`);
  }

  revalidatePath(PATH);
  redirect(`${PATH}?saved=${encodeURIComponent('Event saved')}`);
}

/** Add a new occasion to the library (an ad-hoc sale, a new yearly event). */
export async function createSaleEvent(formData: FormData): Promise<void> {
  const session = await assertSales();
  const name = ((formData.get('name') as string) ?? '').trim().slice(0, 80);
  if (!name) redirect(`${PATH}?error=${encodeURIComponent('Give the occasion a name.')}`);

  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
    || `occasion-${Date.now()}`;
  const admin = supabaseAdmin();
  const { data: maxRow } = await admin.from('sale_events')
    .select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const sort = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 10;

  const { data, error } = await admin.from('sale_events')
    .insert({ key, name, theme: 'sale', sort_order: sort })
    .select('id').single();
  if (error) {
    const msg = error.code === '23505'
      ? 'An occasion with that name already exists.' : error.message;
    redirect(`${PATH}?error=${encodeURIComponent(msg)}`);
  }

  void logAudit(session, { action: 'sale_event.create', entity: 'sale_events', entity_id: (data as { id: string }).id, diff: { key, name } });
  revalidatePath(PATH);
  redirect(`${PATH}?saved=${encodeURIComponent(`${name} added — set its theme, dates and copy, then it's one click for ever after`)}&edit=${encodeURIComponent(key)}`);
}

/** Remove an occasion from the library. The live/armed one can't be deleted —
 *  turn the season off first, so the storefront can never point at nothing. */
export async function deleteSaleEvent(formData: FormData): Promise<void> {
  const session = await assertSales();
  const id = (formData.get('id') as string) ?? '';
  if (formData.get('confirm') !== 'yes') {
    redirect(`${PATH}?error=${encodeURIComponent('Tick the confirmation box to delete an occasion.')}`);
  }
  const event = id ? await loadEvent(id) : null;
  if (!event) redirect(`${PATH}?error=${encodeURIComponent('Sale event not found.')}`);

  const settingsNow = await getSiteSettings();
  if (eventActivationState(event, settingsNow)) {
    redirect(`${PATH}?error=${encodeURIComponent(`${event.name} is currently live or scheduled — switch the seasonal look off first, then delete it.`)}`);
  }

  const { error } = await supabaseAdmin().from('sale_events').delete().eq('id', event.id);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);

  void logAudit(session, { action: 'sale_event.delete', entity: 'sale_events', entity_id: event.id, diff: { key: event.key, name: event.name } });
  revalidatePath(PATH);
  redirect(`${PATH}?saved=${encodeURIComponent(`${event.name} removed from the library`)}`);
}
