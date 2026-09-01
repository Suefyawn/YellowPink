'use server';

// Sales & occasions: one-click activation of a saved sale "version".
// Activation copies the event's fields into the seasonal-theme settings keys
// (the exact keys Branding writes), so the storefront pipeline is unchanged
// and Branding remains the manual override for anything ad-hoc.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { normalizeTheme } from '@/lib/themes';
import {
  saleEventToSeasonalSettings, seasonOffSettings,
  type ActivationMode, type SaleEvent,
} from '@/lib/sale-events';

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

  void logAudit(session, {
    action: mode === 'now' ? 'sale_event.activate' : 'sale_event.schedule',
    entity: 'sale_events',
    entity_id: event.id,
    diff: { key: event.key, theme: event.theme, mode },
  });
  bustStorefront();
  redirect(`${PATH}?saved=${encodeURIComponent(mode === 'now'
    ? `${event.name} is live on the storefront`
    : `${event.name} scheduled ${event.starts_on} to ${event.ends_on}`)}`);
}

export async function activateSaleEventNow(formData: FormData): Promise<void> {
  await activate(formData, 'now');
}

export async function scheduleSaleEvent(formData: FormData): Promise<void> {
  await activate(formData, 'schedule');
}

/** One switch back to the year-round look (clears manual AND scheduled). */
export async function turnOffSeason(): Promise<void> {
  const session = await assertSales();
  const dbError = await writeSettings(seasonOffSettings());
  if (dbError) redirect(`${PATH}?error=${encodeURIComponent(dbError)}`);
  void logAudit(session, { action: 'sale_event.off', entity: 'sale_events', diff: {} });
  bustStorefront();
  redirect(`${PATH}?saved=${encodeURIComponent('Seasonal look switched off, the store is back to the year-round theme')}`);
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

  const patch = {
    theme,
    starts_on: starts,
    ends_on: ends,
    bar_message: text('bar_message', 160),
    bar_coupon: text('bar_coupon', 40)?.toUpperCase() ?? null,
    hero_overline: text('hero_overline', 80),
    hero_headline: text('hero_headline', 200)?.replace(/\n/g, '<br/>') ?? null,
    hero_subline: text('hero_subline', 400),
    hero_cta1_text: text('hero_cta1_text', 40),
    hero_cta1_url: text('hero_cta1_url', 300),
    hero_image_url: text('hero_image_url', 500),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin().from('sale_events').update(patch).eq('id', id);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);

  void logAudit(session, { action: 'sale_event.update', entity: 'sale_events', entity_id: id, diff: { theme, starts_on: starts, ends_on: ends } });
  revalidatePath(PATH);
  redirect(`${PATH}?saved=${encodeURIComponent('Event saved')}`);
}
