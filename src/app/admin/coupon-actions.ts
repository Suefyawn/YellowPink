'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { WELCOME_CODE } from '@/lib/commerce';

// Errors are surfaced to the user via ?error=... on the coupons page rather
// than swallowed silently, the previous version dropped insert errors on the
// floor, leaving the admin with a cleared form and no idea why nothing
// happened (QA Session 2 finding).
function bounceCoupons(error: string): never {
  redirect(`/admin/coupons?error=${encodeURIComponent(error)}`);
}

// The form's Type select covers the legacy `type` values plus free shipping.
// A free-shipping coupon carries no line discount: it's stored as
// value = 0 + free_shipping = true + discount_type = 'free_shipping'
// (migration 014 columns; place_order zeroes the delivery charge for it).
type CouponFormType = 'percent' | 'fixed' | 'free_shipping';

function couponColumns(type: CouponFormType, value: number) {
  if (type === 'free_shipping') {
    return { type: 'fixed' as const, value: 0, discount_type: 'free_shipping', free_shipping: true };
  }
  return {
    type,
    value,
    discount_type: type === 'percent' ? 'percent' : 'fixed_cart',
    free_shipping: false,
  };
}

// Advanced targeting fields shared by create + update. All of these are
// already enforced server-side by place_order (migration 301); the admin
// forms just didn't expose them until the 2026-07 coupons extension.
function advancedColumns(formData: FormData): { error?: string; cols?: Record<string, unknown> } {
  const usageLimitRaw = formData.get('usage_limit_per_user');
  const usage_limit_per_user = usageLimitRaw ? Number(usageLimitRaw) : null;
  if (usage_limit_per_user !== null && (!Number.isInteger(usage_limit_per_user) || usage_limit_per_user < 1)) {
    return { error: 'Per-customer limit must be a whole number of at least 1.' };
  }
  const maxOrderRaw = formData.get('max_order');
  const max_order = maxOrderRaw ? Number(maxOrderRaw) : null;
  if (max_order !== null && (!Number.isFinite(max_order) || max_order <= 0)) {
    return { error: 'Max order must be a positive amount.' };
  }
  // Comma/newline-separated; entries are exact emails or *@domain wildcards
  // (the same Woo-style match place_order and coupon-validation implement).
  const email_restrictions = ((formData.get('email_restrictions') as string) ?? '')
    .split(/[\n,]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  for (const e of email_restrictions) {
    if (!/^(\*@)?[^\s@]+(@[^\s@]+)?$/.test(e) || (!e.startsWith('*@') && !e.includes('@'))) {
      return { error: `"${e}" is not a valid email or *@domain restriction.` };
    }
  }
  const description = ((formData.get('description') as string) ?? '').trim() || null;

  // Product scoping (ProductMultiSelect hidden inputs, CSV of uuids). The
  // fields are optional — a form that doesn't render the pickers (the create
  // form) leaves scoping untouched via `undefined`, never wiping it.
  const parseIds = (field: string): string[] | undefined => {
    const raw = formData.get(field);
    if (raw === null) return undefined;
    return String(raw).split(',').map(s => s.trim()).filter(Boolean);
  };
  const product_ids = parseIds('product_ids');
  const excluded_product_ids = parseIds('excluded_product_ids');

  // Checkbox with a rendered-marker: absent marker (create form) leaves the
  // column untouched; present marker records the checkbox state as-is.
  const exclude_sale_items = formData.get('exclude_sale_items_present') === '1'
    ? formData.get('exclude_sale_items') === 'true'
    : undefined;

  return { cols: {
    usage_limit_per_user, max_order, email_restrictions, description,
    ...(product_ids !== undefined ? { product_ids } : {}),
    ...(excluded_product_ids !== undefined ? { excluded_product_ids } : {}),
    ...(exclude_sale_items !== undefined ? { exclude_sale_items } : {}),
  } };
}

// Buy X get Y (migration 1130): the config lives in coupons.bxgy (jsonb) and
// overrides the value/type maths — the row is stored with type='percent',
// value=0. Works with both trigger kinds (code and automatic). Field names
// follow Shopify's editor: "Customer buys" (quantity + products), "Customer
// gets" (quantity + products + free or a percentage), max uses per order.
type BxgyConfig = {
  buy_product_ids: string[];
  buy_qty: number;
  get_product_ids: string[];
  get_qty: number;
  pct_off: number;
  max_per_order: number;
};

function bxgyColumns(formData: FormData): { error?: string; bxgy?: BxgyConfig } {
  const parseIds = (field: string): string[] =>
    String(formData.get(field) ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const buy_product_ids = parseIds('bxgy_buy_product_ids');
  const get_product_ids = parseIds('bxgy_get_product_ids');
  if (buy_product_ids.length === 0) {
    return { error: 'Pick at least one product the customer buys.' };
  }
  if (get_product_ids.length === 0) {
    return { error: 'Pick at least one product the customer gets.' };
  }
  const buy_qty = Number(formData.get('bxgy_buy_qty'));
  const get_qty = Number(formData.get('bxgy_get_qty'));
  if (!Number.isInteger(buy_qty) || buy_qty < 1 || !Number.isInteger(get_qty) || get_qty < 1) {
    return { error: 'Buy and get quantities must be whole numbers of at least 1.' };
  }
  // Discount value: Free stores 100; Percentage stores the entered 1–100.
  const pct_off = formData.get('bxgy_value_kind') === 'free'
    ? 100
    : Number(formData.get('bxgy_pct_off'));
  if (!Number.isFinite(pct_off) || pct_off < 1 || pct_off > 100) {
    return { error: 'The percentage off must be between 1 and 100.' };
  }
  const max_per_order = Number(formData.get('bxgy_max_per_order') || 1);
  if (!Number.isInteger(max_per_order) || max_per_order < 1) {
    return { error: 'Maximum uses per order must be a whole number of at least 1.' };
  }
  return { bxgy: { buy_product_ids, buy_qty, get_product_ids, get_qty, pct_off, max_per_order } };
}

// Automatic discounts (migration 1120): the shopper never types a code, so the
// action mints an internal one. The title is required — it's the discount line
// label the shopper sees on the cart and checkout.
function automaticTitle(formData: FormData): { error?: string; title?: string } {
  const title = ((formData.get('title') as string) ?? '').trim();
  if (!title) return { error: 'Title is required for an automatic discount.' };
  if (title.length > 120) return { error: 'Title must be 120 characters or fewer.' };
  return { title };
}

function generateAutomaticCode(): string {
  return 'AUTO-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

// useActionState shape: errors come back as state (the create form is a
// client component that keeps its fields), success still redirects with
// ?created=<code> for the page banner. The previous version bounced errors
// via redirect, which re-rendered the page and wiped everything the admin
// had typed into the create form.
export async function createCoupon(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await assertPermission('coupons');
  // Method: 'code' (shopper types it, the default) or 'automatic' (the cart
  // applies it by itself; the code is generated and never shown to shoppers).
  const trigger_kind = formData.get('trigger_kind') === 'automatic' ? 'automatic' : 'code';
  let title: string | null = null;
  let code: string;
  if (trigger_kind === 'automatic') {
    const t = automaticTitle(formData);
    if (t.error) return { error: t.error };
    title = t.title!;
    code = generateAutomaticCode();
  } else {
    code = ((formData.get('code') as string) ?? '').trim().toUpperCase();
  }
  // Discount kind: 'amount' (the percent/fixed/free-shipping maths) or
  // 'bxgy' (Buy X get Y, config in the bxgy jsonb, value/type unused).
  const isBxgy = formData.get('discount_kind') === 'bxgy';
  const type = formData.get('type') as CouponFormType;
  const valueRaw = formData.get('value');
  const value = Number(valueRaw);
  const min_order = Number(formData.get('min_order') ?? 0);
  const max_uses = formData.get('max_uses') ? Number(formData.get('max_uses')) : null;
  const expires_at = (formData.get('expires_at') as string) || null;
  const starts_at = (formData.get('starts_at') as string) || null;
  const isFreeShipping = type === 'free_shipping';

  if (trigger_kind === 'code') {
    if (!code) return { error: 'Code is required.' };
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      return { error: 'Code may only contain letters, numbers, - and _.' };
    }
  }
  let bxgy: BxgyConfig | null = null;
  if (isBxgy) {
    const parsed = bxgyColumns(formData);
    if (parsed.error) return { error: parsed.error };
    bxgy = parsed.bxgy!;
  } else {
    if (!type) return { error: 'Type is required.' };
    // Free-shipping coupons have no monetary value; skip the value checks.
    if (!isFreeShipping) {
      if (!valueRaw || !Number.isFinite(value)) return { error: 'Value is required.' };
      if (value <= 0) return { error: 'Value must be greater than zero.' };
      if (type === 'percent' && value > 100) {
        return { error: 'A percentage discount cannot exceed 100%.' };
      }
    }
  }

  const adv = advancedColumns(formData);
  if (adv.error) return { error: adv.error };

  // A BXGY row stores value=0 / type='percent' (the coupons_value_check
  // carve-out from migration 1130) — the discount comes from the config.
  const valueCols = isBxgy
    ? { type: 'percent' as const, value: 0, discount_type: 'percent', free_shipping: false, bxgy }
    : couponColumns(type, value);

  // coupons RLS bars anon write/read after migration 070; admin
  // mutations must go through the service role.
  const { data: created, error } = await supabaseAdmin()
    .from('coupons')
    .insert({ code, trigger_kind, title, ...valueCols, min_order, max_uses, expires_at, starts_at, ...adv.cols })
    .select('id')
    .single();

  if (error || !created) {
    log.error('coupon.create_failed', { code, error: error?.message });
    // Postgres 23505, UNIQUE violation on coupon code.
    if ((error as { code?: string } | null)?.code === '23505') {
      return { error: `A coupon with code "${code}" already exists.` };
    }
    return { error: error?.message ?? 'Could not create coupon. Please try again.' };
  }

  void logAudit(session, {
    action: 'coupon.create', entity: 'coupons', entity_id: created.id,
    diff: { code, trigger_kind, title, type, value, min_order, max_uses, expires_at, ...(bxgy ? { bxgy } : {}) },
  });
  revalidatePath('/admin/coupons');
  // The banner names the thing the admin recognises: the title for an
  // automatic (its code is internal), the code otherwise.
  redirect(`/admin/coupons?created=${encodeURIComponent(trigger_kind === 'automatic' ? title! : code)}`);
}

export async function updateCoupon(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await assertPermission('coupons');
  const id = formData.get('id') as string;
  const type = formData.get('type') as CouponFormType;
  const value = Number(formData.get('value'));
  const min_order = Number(formData.get('min_order') ?? 0);
  const max_uses = formData.get('max_uses') ? Number(formData.get('max_uses')) : null;
  const expires_at = (formData.get('expires_at') as string) || null;
  const starts_at = (formData.get('starts_at') as string) || null;
  const isFreeShipping = type === 'free_shipping';

  if (!id) return { error: 'Missing coupon id.' };

  // trigger_kind is fixed at creation (switching method is out of scope) —
  // the update NEVER writes it, and an automatic keeps its internal code no
  // matter what the form submits. The same goes for the discount kind: a
  // Buy X get Y coupon stays BXGY (its config is editable, its kind isn't).
  const { data: existing } = await supabaseAdmin().from('coupons').select('code, trigger_kind, bxgy').eq('id', id).single();
  const isAutomatic = existing?.trigger_kind === 'automatic';
  const isBxgy = existing?.bxgy != null;
  const code = isAutomatic
    ? existing!.code
    : ((formData.get('code') as string) ?? '').trim().toUpperCase();
  let title: string | null = null;
  if (isAutomatic) {
    const t = automaticTitle(formData);
    if (t.error) return { error: t.error };
    title = t.title!;
  }

  if (!code) return { error: 'Code is required.' };
  if (!/^[A-Z0-9_-]+$/.test(code)) return { error: 'Code may only contain letters, numbers, - and _.' };
  // A BXGY coupon's form carries no Type/Value fields — its maths lives in
  // the bxgy config, re-validated below.
  let bxgy: BxgyConfig | null = null;
  if (isBxgy) {
    const parsed = bxgyColumns(formData);
    if (parsed.error) return { error: parsed.error };
    bxgy = parsed.bxgy!;
  } else {
    if (!type || (!isFreeShipping && !value)) return { error: 'Type and value are required.' };
    if (!isFreeShipping) {
      if (value <= 0) return { error: 'Value must be greater than zero.' };
      if (type === 'percent' && value > 100) return { error: 'A percentage discount cannot exceed 100%.' };
    }
  }

  const adv = advancedColumns(formData);
  if (adv.error) return { error: adv.error };

  // The newsletter popup + welcome email advertise WELCOME_CODE by name
  // (lib/offers.ts). Renaming it would break every promise already sent, so
  // the code itself is locked; values (percent, min order, limits) stay
  // editable and the storefront copy follows them automatically.
  if (existing && existing.code.toUpperCase() === WELCOME_CODE && code !== WELCOME_CODE) {
    return { error: `${WELCOME_CODE} is advertised by the newsletter popup and welcome email — its code can't be renamed. Edit its values instead, or deactivate it to stop offering the discount.` };
  }

  // BXGY keeps its stored value=0 / type='percent' columns and only the
  // config changes; amount coupons write the type/value columns as before.
  const valueCols = isBxgy ? { bxgy } : couponColumns(type, value);

  const { error } = await supabaseAdmin()
    .from('coupons')
    .update({ code, ...(isAutomatic ? { title } : {}), ...valueCols, min_order, max_uses, expires_at, starts_at, ...adv.cols })
    .eq('id', id);
  if (error) return { error: error.message };

  void logAudit(session, {
    action: 'coupon.update', entity: 'coupons', entity_id: id,
    diff: {
      code, ...(isAutomatic ? { title } : {}), min_order, max_uses, expires_at,
      ...(isBxgy ? { bxgy } : { type, value: isFreeShipping ? 0 : value }),
    },
  });
  revalidatePath('/admin/coupons');
  return { ok: true };
}

export async function deleteCoupon(formData: FormData) {
  const session = await assertPermission('coupons');
  const id = formData.get('id') as string;
  if (!id) bounceCoupons('Missing coupon id.');

  const { data: target } = await supabaseAdmin().from('coupons').select('code').eq('id', id).single();
  // Deleting the advertised welcome coupon is how the site once ended up
  // promising a code checkout rejects (the popup/email fall back to the
  // seeded copy when the row is gone). Deactivate instead — the popup and
  // welcome email drop the offer automatically when it's inactive.
  if (target && target.code.toUpperCase() === WELCOME_CODE) {
    bounceCoupons(`${WELCOME_CODE} is advertised by the newsletter popup and welcome email. Deactivate it to stop offering the discount — deleting it would leave the site promising a dead code.`);
  }
  const { error } = await supabaseAdmin().from('coupons').delete().eq('id', id);
  if (error) {
    log.error('coupon.delete_failed', { id, error: error.message });
    bounceCoupons(`Could not delete coupon: ${error.message}`);
  }

  void logAudit(session, {
    action: 'coupon.delete', entity: 'coupons', entity_id: id,
    diff: { code: target?.code },
  });
  revalidatePath('/admin/coupons');
}

export async function toggleCoupon(id: string, active: boolean) {
  const session = await assertPermission('coupons');
  const { error } = await supabaseAdmin().from('coupons').update({ active }).eq('id', id);
  if (error) {
    log.error('coupon.toggle_failed', { id, active, error: error.message });
    bounceCoupons(`Could not change coupon status: ${error.message}`);
  }
  void logAudit(session, {
    action: active ? 'coupon.activate' : 'coupon.deactivate',
    entity: 'coupons', entity_id: id,
  });
  revalidatePath('/admin/coupons');
}
