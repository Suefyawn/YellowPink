'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { boolField } from '@/lib/validators';

const PATH = '/admin/settings/shipping';

// Gated like the rest of the settings surface: the 'settings' permission
// advertises shipping-zone management, so zone actions must accept it —
// owner-only here left settings-granted staff with a full-page Unauthorized
// on save while the defaults form on the same page succeeded.
async function assertSettings() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

function err(message: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(message)}`);
}

function ok(): never {
  revalidatePath(PATH);
  revalidatePath('/', 'layout');
  redirect(`${PATH}?saved=1`);
}

// The 7 Pakistan provinces the checkout dropdown emits. A province maps to at
// most one zone (province_zones PK is `province`), so assigning it here moves
// it off any other zone.
const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan'];

interface ZoneFields {
  name: string;
  active: boolean;
  sort_order: number;
  rate: number;
  cost: number | null;
  free_shipping_threshold: number | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  provinces: string[];
}

function parseZone(formData: FormData): ZoneFields {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!name) err('Zone name is required.');

  const rateRaw = (formData.get('rate') as string | null)?.trim() ?? '';
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate < 0) err('Rate must be a non-negative number.');

  const costRaw = (formData.get('cost') as string | null)?.trim() ?? '';
  const cost = costRaw === '' ? null : Number(costRaw);
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) err('Cost must be a non-negative number or blank.');

  const freeThresholdRaw = (formData.get('free_shipping_threshold') as string | null)?.trim() ?? '';
  const free_shipping_threshold = freeThresholdRaw === '' ? null : Number(freeThresholdRaw);
  if (free_shipping_threshold !== null && (!Number.isFinite(free_shipping_threshold) || free_shipping_threshold < 0)) {
    err('Free-shipping threshold must be a non-negative number or blank.');
  }

  // Only accept known province names; the form sends one 'provinces' entry per
  // checked box.
  const provinces = formData.getAll('provinces').map(String).filter(p => PROVINCES.includes(p));

  const sortRaw = (formData.get('sort_order') as string | null)?.trim() ?? '0';
  const sort_order = Number(sortRaw);
  if (!Number.isFinite(sort_order)) err('Sort order must be a number.');

  const minRaw = (formData.get('estimated_days_min') as string | null)?.trim() ?? '';
  const estimated_days_min = minRaw === '' ? null : Number(minRaw);
  const maxRaw = (formData.get('estimated_days_max') as string | null)?.trim() ?? '';
  const estimated_days_max = maxRaw === '' ? null : Number(maxRaw);

  return {
    name,
    // The `active` Toggle submits a hidden 'false' before the checkbox 'true';
    // read it with boolField so the checkbox (last value) wins, not the hidden.
    active: boolField(formData, 'active'),
    sort_order,
    rate,
    cost,
    free_shipping_threshold,
    estimated_days_min,
    estimated_days_max,
    provinces,
  };
}

// Reassign a zone's provinces. province_zones PK is `province`, so upserting a
// province onto this zone moves it off whatever zone it was on; clearing this
// zone's other rows drops any province that was un-checked.
async function syncProvinces(
  sb: ReturnType<typeof supabaseAdmin>,
  zoneId: string,
  provinces: string[],
): Promise<string | null> {
  // Drop provinces previously on this zone that are no longer selected.
  const del = provinces.length
    ? await sb.from('province_zones').delete().eq('zone_id', zoneId).not('province', 'in', `(${provinces.join(',')})`)
    : await sb.from('province_zones').delete().eq('zone_id', zoneId);
  if (del.error) return del.error.message;
  // Claim the selected provinces for this zone (moves them off other zones).
  if (provinces.length) {
    const { error } = await sb
      .from('province_zones')
      .upsert(provinces.map(p => ({ province: p, zone_id: zoneId })), { onConflict: 'province' });
    if (error) return error.message;
  }
  return null;
}

export async function createZone(formData: FormData): Promise<void> {
  const session = await assertSettings();
  const z = parseZone(formData);

  const sb = supabaseAdmin();

  const { data: zone, error: zoneErr } = await sb
    .from('shipping_zones')
    .insert({ name: z.name, active: z.active, sort_order: z.sort_order })
    .select('id')
    .single();
  if (zoneErr) {
    if (zoneErr.code === '23505') err(`A zone named "${z.name}" already exists.`);
    err(zoneErr.message);
  }

  const { error: rateErr } = await sb.from('shipping_rates').insert({
    zone_id: zone!.id,
    rate: z.rate,
    cost: z.cost,
    free_shipping_threshold: z.free_shipping_threshold,
    label: 'Standard',
    estimated_days_min: z.estimated_days_min,
    estimated_days_max: z.estimated_days_max,
  });
  if (rateErr) {
    // Best effort: roll back the zone since the rate insert failed.
    await sb.from('shipping_zones').delete().eq('id', zone!.id);
    err(rateErr.message);
  }

  const provErr = await syncProvinces(sb, zone!.id, z.provinces);
  if (provErr) err(provErr);

  void logAudit(session, {
    action: 'shipping_zone.create',
    entity: 'shipping_zones',
    entity_id: zone!.id,
    diff: { name: z.name, rate: z.rate },
  });
  ok();
}

export async function updateZone(id: string, formData: FormData): Promise<void> {
  const session = await assertSettings();
  const z = parseZone(formData);

  const sb = supabaseAdmin();

  const { error: zoneErr } = await sb
    .from('shipping_zones')
    .update({ name: z.name, active: z.active, sort_order: z.sort_order })
    .eq('id', id);
  if (zoneErr) {
    if (zoneErr.code === '23505') err(`A zone named "${z.name}" already exists.`);
    err(zoneErr.message);
  }

  // Upsert the rate by zone_id, assume a single rate per zone for now.
  // If a row exists, update it; otherwise insert a fresh one.
  const { data: existingRate } = await sb
    .from('shipping_rates')
    .select('id')
    .eq('zone_id', id)
    .limit(1)
    .maybeSingle();

  const ratePatch = {
    zone_id: id,
    rate: z.rate,
    cost: z.cost,
    free_shipping_threshold: z.free_shipping_threshold,
    estimated_days_min: z.estimated_days_min,
    estimated_days_max: z.estimated_days_max,
    label: 'Standard',
  };

  if (existingRate?.id) {
    const { error: rateErr } = await sb.from('shipping_rates').update(ratePatch).eq('id', existingRate.id);
    if (rateErr) err(rateErr.message);
  } else {
    const { error: rateErr } = await sb.from('shipping_rates').insert(ratePatch);
    if (rateErr) err(rateErr.message);
  }

  const provErr = await syncProvinces(sb, id, z.provinces);
  if (provErr) err(provErr);

  void logAudit(session, {
    action: 'shipping_zone.update',
    entity: 'shipping_zones',
    entity_id: id,
    diff: { name: z.name, rate: z.rate },
  });
  ok();
}

export async function deleteZone(formData: FormData): Promise<void> {
  const session = await assertSettings();
  const id = formData.get('id') as string;
  if (!id) err('Missing zone id.');

  // shipping_rates and province_zones cascade on delete via FK.
  const { error } = await supabaseAdmin().from('shipping_zones').delete().eq('id', id);
  if (error) err(error.message);

  void logAudit(session, {
    action: 'shipping_zone.delete',
    entity: 'shipping_zones',
    entity_id: id,
  });
  ok();
}
