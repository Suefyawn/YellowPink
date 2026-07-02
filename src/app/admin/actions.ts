'use server';

import { createHash, timingSafeEqual } from 'crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import {
  verifyPassword, upgradeStaffHash,
  setStaffCookie, clearStaffCookie,
} from '@/lib/staff-auth';
import { authLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { assertPermission } from '@/lib/admin-auth';
import { productInputSchema, blogPostInputSchema, parseForm, firstError } from '@/lib/validators';
import { logAudit } from '@/lib/audit';
import { submitToSearchEngines, submitToSearchEnginesQuietly } from '@/lib/indexing';
import { revalidateStorefrontCatalog } from '@/lib/revalidate-storefront';
import { log } from '@/lib/logger';
import { verifyTotp } from '@/lib/totp';
import { orderRangeSinceIso } from '@/lib/order-range';
import type { StaffSession } from '@/lib/permissions';
import type { Order, OrderStatus } from '@/types';

// ─── Auth ────────────────────────────────────────────────────────────────────

async function checkAuthRate(): Promise<{ error: string } | null> {
  const h = await headers();
  const ip = ipFromHeaders(h);
  const { success } = await authLimiter.limit(ip);
  if (!success) return { error: 'Too many attempts. Wait a minute, then try again.' };
  return null;
}

export async function loginAdmin(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const rateError = await checkAuthRate();
  if (rateError) return rateError;

  const password = formData.get('password') as string;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { error: 'Admin access is not configured. Set ADMIN_PASSWORD environment variable.' };
  // Constant-time compare on equal-length inputs only.
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: 'Incorrect password' };
  }
  // P1 audit fix: cookie value is now an HMAC-signed payload with a
  // timestamp instead of base64(password). Anyone who reads the cookie
  // can no longer recover the password, and an old leaked cookie expires
  // server-side after 7 days regardless of when the client gives it back.
  const { sign, OWNER_COOKIE_NAME, OWNER_COOKIE_TTL_SEC } = await import('@/lib/signed-cookie');
  const { STAFF_SESSION_SECRET } = await import('@/lib/session-secret');
  const token = await sign({ sub: 'owner' }, STAFF_SESSION_SECRET());
  const store = await cookies();
  store.set(OWNER_COOKIE_NAME, token, {
    httpOnly: true,
    // Always secure, even on Vercel previews this rides HTTPS.
    secure: true,
    maxAge: OWNER_COOKIE_TTL_SEC,
    path: '/',
    // strict, matching the staff cookie, see setStaffCookie for rationale.
    sameSite: 'strict',
  });
  redirect('/admin/dashboard');
}

export async function loginStaff(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const rateError = await checkAuthRate();
  if (rateError) return rateError;

  const email = (formData.get('email') as string).trim().toLowerCase();
  const password = formData.get('password') as string;
  const totpCode = (formData.get('totp') as string | null)?.trim() ?? '';
  if (!email || !password) return { error: 'Email and password are required' };

  const { data } = await supabaseAdmin()
    .from('staff_members')
    .select('id, password_hash, password_salt, is_active, totp_enabled, totp_secret, backup_codes')
    .eq('email', email)
    .single();

  if (!data || !data.is_active) return { error: 'Invalid email or password' };

  const verify = verifyPassword(password, data.password_hash, data.password_salt);
  if (!verify.ok) return { error: 'Invalid email or password' };

  if (verify.upgraded) {
    await upgradeStaffHash(data.id, verify.upgraded.newHash);
  }

  // 2FA gate, if enabled for this staff member.
  if (data.totp_enabled && data.totp_secret) {
    if (!totpCode) return { error: 'Enter your 2FA code from your authenticator app' };
    const codeIsTotp = verifyTotp(data.totp_secret as string, totpCode);
    let codeIsBackup = false;
    let backupCodes = (data.backup_codes as string[]) ?? [];
    if (!codeIsTotp) {
      // Backup codes are stored as SHA-256(lowercased, whitespace-stripped)
      // since the 2fa-actions enrollment switch. Compute the hash of the
      // submitted code and look it up in the stored hash list. Old plaintext
      // codes from before the switch will fail to match, staff will have to
      // re-enroll once. Hash strings are 64-char lowercase hex so they can't
      // collide with the old 8-char hex plaintext.
      const cleaned = totpCode.replace(/\s+/g, '').toLowerCase();
      const submittedHash = createHash('sha256').update(cleaned).digest('hex');
      const idx = backupCodes.findIndex(c => c === submittedHash);
      if (idx >= 0) {
        // Atomically burn the code: only update if it's still present in the
        // row. Two concurrent logins racing on the same backup code can BOTH
        // pass the in-memory findIndex check; the .contains() filter means
        // only the first UPDATE matches a row. The loser sees zero rows
        // affected and is rejected as if the code didn't match, so no second
        // login can ride a single backup code through.
        const updatedCodes = backupCodes.filter((_, i) => i !== idx);
        const { data: updated, error: burnError } = await supabaseAdmin()
          .from('staff_members')
          .update({ backup_codes: updatedCodes })
          .eq('id', data.id)
          .contains('backup_codes', [submittedHash])
          .select('id');
        if (burnError) {
          // Refuse the login rather than let an unburned backup code be
          // reused indefinitely (#191).
          log.error('staff.backup_code_burn_failed', { staff_id: data.id, error: burnError.message });
          return { error: 'Could not complete sign-in. Please try again.' };
        }
        if (!updated || updated.length === 0) {
          // Concurrent login already burned this code. Treat as "invalid 2FA
          // code" so the loser sees a normal failure rather than a hint that
          // someone else just signed in with the same backup.
          log.warn('staff.backup_code_race_lost', { staff_id: data.id });
          return { error: 'Invalid 2FA code' };
        }
        codeIsBackup = true;
        backupCodes = updatedCodes;
      }
    }
    if (!codeIsTotp && !codeIsBackup) return { error: 'Invalid 2FA code' };
  }

  await setStaffCookie(data.id);
  redirect('/admin/dashboard');
}

export async function logoutAdmin() {
  const store = await cookies();
  store.delete('admin_session');
  await clearStaffCookie();
  redirect('/admin');
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function createProduct(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await assertPermission('products.edit');
  const parsed = parseForm(productInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { data, error } = await supabaseAdmin().from('products').insert(parsed.data).select('id, slug, status').single();
  if (error) return { error: error.message };
  await logAudit(session, { action: 'product.create', entity: 'product', entity_id: data?.id as string | undefined, diff: parsed.data });
  // Nudge search engines as soon as a live product appears (best-effort).
  const created = data as { slug?: string; status?: string } | null;
  if (created?.slug && created.status === 'published') {
    await submitToSearchEnginesQuietly([`/product/${created.slug}`]);
  }
  revalidatePath('/admin/products');
  revalidateStorefrontCatalog();
  redirect('/admin/products');
}

export async function updateProduct(
  id: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await assertPermission('products.edit');
  const parsed = parseForm(productInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  // Snapshot the prior state for the audit diff.
  const { data: before } = await supabaseAdmin().from('products').select('*').eq('id', id).maybeSingle();
  const { error } = await supabaseAdmin().from('products').update(parsed.data).eq('id', id);
  if (error) return { error: error.message };
  await logAudit(session, { action: 'product.update', entity: 'product', entity_id: id, diff: { before, after: parsed.data } });
  // Re-submit to search engines when the product is live (best-effort).
  const { data: after } = await supabaseAdmin().from('products').select('slug, status').eq('id', id).maybeSingle();
  const live = after as { slug?: string; status?: string } | null;
  if (live?.slug && live.status === 'published') {
    await submitToSearchEnginesQuietly([`/product/${live.slug}`]);
  }
  revalidatePath('/admin/products');
  revalidateStorefrontCatalog();
  redirect('/admin/products');
}

export async function deleteProduct(formData: FormData) {
  const session = await assertPermission('products.delete');
  const id = formData.get('id') as string;
  const admin = supabaseAdmin();

  // A product that has ever appeared in a customer order is archived, not
  // hard-deleted. Orders snapshot their line items as denormalised jsonb keyed
  // by product id, and Analytics (Top Products) joins that id back to the
  // products table for the display name. Deleting the row would leave
  // "Unknown product (deleted)" entries and break the order detail view.
  // Archiving keeps the row but hides it from the storefront via status.
  const { productsWithOrderHistory } = await import('@/lib/product-archive');
  const referenced = await productsWithOrderHistory([id]);
  if (referenced.has(id)) {
    const { error } = await admin.from('products').update({ status: 'archived' }).eq('id', id);
    if (error) {
      redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
    }
    await logAudit(session, { action: 'product.archive', entity: 'product', entity_id: id, diff: { reason: 'has_order_history' } });
    revalidatePath('/admin/products');
    revalidateStorefrontCatalog();
    redirect('/admin/products?archived=1');
  }

  const { error } = await admin.from('products').delete().eq('id', id);
  if (error) {
    // Surface via query string. Index page reads ?error= and shows a toast.
    redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  }
  await logAudit(session, { action: 'product.delete', entity: 'product', entity_id: id });
  revalidatePath('/admin/products');
  revalidateStorefrontCatalog();
  redirect('/admin/products?deleted=1');
}

// ─── Orders / customers, destructive deletes ──────────────────────────────────

/** Permanently delete an order. Dependent rows are handled by the FK rules:
 *  payments / order_events / shipments / return_requests / vendor_settlements
 *  CASCADE; ledger + redemption links SET NULL. Gated on orders.delete. */
export async function deleteOrder(formData: FormData) {
  const session = await assertPermission('orders.delete');
  const id = formData.get('id') as string;
  const admin = supabaseAdmin();
  const { data: ord } = await admin.from('orders').select('order_number').eq('id', id).maybeSingle();
  const { error } = await admin.from('orders').delete().eq('id', id);
  if (error) redirect(`/admin/orders/${id}?err=` + encodeURIComponent(error.message));
  await logAudit(session, { action: 'order.delete', entity: 'order', entity_id: id, diff: { order_number: (ord as { order_number?: string } | null)?.order_number } });
  revalidatePath('/admin/orders');
  redirect('/admin/orders?deleted=1');
}

/** Permanently delete a registered customer account (auth user + profile).
 *  Their orders are DETACHED (user_id → null) rather than deleted, so the
 *  order/revenue history is preserved as guest orders. Guests have no account
 *  to delete. Gated on customers.delete. */
export async function deleteCustomer(formData: FormData) {
  const session = await assertPermission('customers.delete');
  const id = formData.get('id') as string;
  if (!id || id.startsWith('guest-')) {
    redirect('/admin/users?err=' + encodeURIComponent('Guest buyers have no account to delete, remove their individual orders instead.'));
  }
  const admin = supabaseAdmin();
  // Preserve financial history: detach the customer's orders before removing
  // the account (orders.user_id → auth.users is NO ACTION, so this also avoids
  // an FK violation on the auth delete).
  const { error: detachErr } = await admin.from('orders').update({ user_id: null }).eq('user_id', id);
  if (detachErr) redirect(`/admin/users/${id}?err=` + encodeURIComponent(detachErr.message));
  await admin.from('profiles').delete().eq('id', id);
  const { error: authErr } = await admin.auth.admin.deleteUser(id);
  if (authErr) redirect(`/admin/users/${id}?err=` + encodeURIComponent(authErr.message));
  await logAudit(session, { action: 'customer.delete', entity: 'customer', entity_id: id, diff: { orders_detached: true } });
  revalidatePath('/admin/users');
  redirect('/admin/users?deleted=1');
}

// ─── Blog ─────────────────────────────────────────────────────────────────────

export async function createBlogPost(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  await assertPermission('blog');
  // `featured` arrives as a checkbox ('on' when ticked, absent otherwise);
  // blogPostInputSchema coerces it to a real boolean.
  const parsed = parseForm(blogPostInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { error } = await supabaseAdmin().from('blog_posts').insert(parsed.data);
  if (error) return { error: error.message };
  // Blog posts go live immediately, ping search engines (best-effort).
  const slug = (parsed.data as { slug?: string }).slug;
  if (slug) await submitToSearchEnginesQuietly([`/blog/${slug}`]);
  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}

export async function updateBlogPost(
  id: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  await assertPermission('blog');
  // See createBlogPost: `featured` is a checkbox coerced by the schema.
  const parsed = parseForm(blogPostInputSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { error } = await supabaseAdmin().from('blog_posts').update(parsed.data).eq('id', id);
  if (error) return { error: error.message };
  const slug = (parsed.data as { slug?: string }).slug;
  if (slug) await submitToSearchEnginesQuietly([`/blog/${slug}`]);
  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}

// ─── Search-engine indexing ────────────────────────────────────────────────────

/** Manually (re)submit a single storefront URL to the search-engine index
 *  channels. Called from the "Submit to index" buttons on the product/blog
 *  forms. Returns a human-readable per-channel summary for a toast. */
export async function requestIndexing(path: string): Promise<{ ok: boolean; message: string }> {
  await assertPermission('products.edit');
  const result = await submitToSearchEngines([path]);
  if (result.submitted.length === 0) return { ok: false, message: 'No valid URL to submit.' };
  const parts = result.results.map(r => {
    const name = r.channel === 'google' ? 'Google' : 'IndexNow';
    if (r.skipped) return `${name}: not configured`;
    return `${name}: ${r.ok ? 'OK' : 'failed'}`;
  });
  const ok = result.results.every(r => r.ok);
  return { ok, message: parts.join(' · ') };
}

/** Re-submit the entire live catalogue + blog to IndexNow in one request.
 *  Google is intentionally skipped here, its publish quota (~200/day) is too
 *  small for a full-site resubmit; auto-on-publish covers Google per-item. */
export async function resubmitAllUrls(): Promise<{ ok: boolean; message: string }> {
  await assertPermission('products.edit');
  const admin = supabaseAdmin();
  const [{ data: prods }, { data: posts }] = await Promise.all([
    admin.from('products').select('slug').eq('status', 'published'),
    admin.from('blog_posts').select('slug'),
  ]);
  const paths = [
    '/', '/shop', '/blog', '/collections',
    ...((prods ?? []) as { slug: string }[]).map(p => `/product/${p.slug}`),
    ...((posts ?? []) as { slug: string }[]).map(p => `/blog/${p.slug}`),
  ];
  const result = await submitToSearchEngines(paths, { google: false });
  const indexnow = result.results.find(r => r.channel === 'indexnow');
  return {
    ok: !!indexnow?.ok,
    message: indexnow?.ok
      ? `Submitted ${result.submitted.length} URLs to IndexNow (Bing/Yandex).`
      : `Submission failed: ${indexnow?.detail ?? 'unknown error'}`,
  };
}

export async function deleteBlogPost(formData: FormData) {
  await assertPermission('blog');
  const id = formData.get('id') as string;
  const { error } = await supabaseAdmin().from('blog_posts').delete().eq('id', id);
  if (error) {
    redirect(`/admin/blog?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/admin/blog');
  redirect('/admin/blog?deleted=1');
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/** The order_events trigger stamps every admin status change `staff` with a
 *  null actor_id, the database can't see the app session. After a status
 *  update, patch the event row the trigger just wrote with the signed-in
 *  operator so the order timeline shows WHO made the change, not just "STAFF".
 *  Only rows with a null actor_id are touched, so past events keep their
 *  original attribution. */
async function attributeOrderEvents(
  admin: ReturnType<typeof supabaseAdmin>,
  orderIds: string[],
  status: OrderStatus,
  session: StaffSession,
): Promise<void> {
  const actor = session.isOwner ? 'owner' : (session.email ?? 'staff');
  for (const orderId of orderIds) {
    const { data: evt } = await admin
      .from('order_events')
      .select('id')
      .eq('order_id', orderId)
      .eq('to_status', status)
      .is('actor_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (evt?.id) {
      await admin.from('order_events').update({ actor_id: actor }).eq('id', evt.id);
    }
  }
}

/** Cancellation restock: push an order's items back into stock via the
 *  inventory ledger. place_order debited the stock at order-creation time
 *  (migration 079); this is the symmetric credit. reason='cancellation'
 *  (migration 080) keeps the /admin/inventory trail distinct from a real
 *  customer return. Shared by the single-order and bulk cancel paths so the
 *  two can never drift. */
async function restockCancelledOrder(
  admin: ReturnType<typeof supabaseAdmin>,
  session: StaffSession,
  order: { id: string; order_number?: string | null; items?: unknown },
): Promise<void> {
  const items = (order.items ?? []) as Array<{ id: string; qty: number; variant_id?: string | null }>;
  for (const it of items) {
    if (!it?.id || !it.qty || it.qty <= 0) continue;
    await admin.rpc('record_stock_change' as never, {
      p_product_id:  it.id,
      p_variant_id:  it.variant_id ?? null,
      p_qty_delta:   it.qty,
      p_reason:      'cancellation',
      p_order_id:    order.id,
      p_return_id:   null,
      p_actor_kind:  session.isOwner ? 'owner' : 'staff',
      p_actor_email: session.email ?? null,
      p_note:        `Restock from order cancellation ${order.order_number ?? order.id.slice(0, 8)}`,
    } as never);
  }
}

/** Server-side CSV export for the Orders list. The browser's anon-key client
 *  can't read `orders` (RLS bars anon SELECT since migration 070), so the
 *  Export button calls this action, which queries with the service role after
 *  a staff-permission check and hands the CSV text back for a client-side
 *  download. Filters mirror the Orders page exactly. */
export async function exportOrdersCsv(
  filters: { status?: string; q?: string; range?: string },
): Promise<{ csv?: string; count?: number; error?: string }> {
  try {
    await assertPermission('orders.view');
  } catch {
    return { error: 'You don’t have permission to export orders.' };
  }
  const { status, q, range } = filters;
  let query = supabaseAdmin().from('orders').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status as OrderStatus);
  // Shared with the Orders page so the export window matches the on-screen
  // filter exactly ("Today" = PKT calendar day, 7d/30d/90d rolling).
  const rangeSince = orderRangeSinceIso(range);
  if (rangeSince) query = query.gte('created_at', rangeSince);
  if (q) {
    // Keep in sync with the orders page search (order #, name, email, phone).
    const term = q.replace(/[(),*]/g, ' ').trim();
    const filter = `order_number.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`;
    query = query.or(filter);
  }
  const { data, error } = await query;
  if (error) return { error: error.message };
  const orders = (data ?? []) as Order[];
  if (orders.length === 0) return { count: 0 };

  const headerRow = ['Order #', 'Date', 'Name', 'Email', 'Phone', 'City', 'Province', 'Address', 'Payment', 'Status', 'Subtotal', 'Discount', 'Shipping', 'Total', 'Tracking #', 'Coupon'];
  const rows = orders.map(o => [
    o.order_number,
    o.created_at ? new Date(o.created_at).toISOString().split('T')[0] : '',
    `${o.first_name} ${o.last_name}`,
    o.email ?? '',
    o.phone,
    o.city,
    o.province ?? '',
    o.address.replace(/,/g, ';'),
    o.pay_method.toUpperCase(),
    o.status ?? 'pending',
    o.subtotal,
    o.discount_amount ?? 0,
    o.shipping,
    o.total,
    o.tracking_number ?? '',
    o.coupon_code ?? '',
  ]);
  const csv = [headerRow, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  return { csv, count: orders.length };
}

/** Resend the order confirmation email, for customers who say they never
 *  received the original (deliverability, spam, typo). Logs the resend so it
 *  shows up in the order's audit trail.
 *  Gated on orders.edit (same as status changes / payment recording).  */
export async function resendOrderConfirmation(id: string): Promise<{ error?: string; success?: boolean }> {
  const session = await assertPermission('orders.edit');
  const admin = supabaseAdmin();
  const { data: o, error } = await admin
    .from('orders')
    .select('order_number, email, first_name, last_name, phone, city, province, total, items, pay_method')
    .eq('id', id)
    .single();
  if (error || !o) return { error: error?.message ?? 'Order not found' };
  if (!o.email) return { error: 'No email on file for this order.' };
  // sendOrderConfirmationEmail never throws for provider-side problems, it
  // reports skips (no API key, quota) and rejections via its boolean result.
  // Surface those to the UI too, "Sent ✓" on a send that never happened was
  // exactly the support-ticket generator this button exists to fix.
  let sent = false;
  try {
    const { sendOrderConfirmationEmail } = await import('@/lib/email');
    sent = await sendOrderConfirmationEmail({
      email: o.email,
      order_number: o.order_number,
      first_name: o.first_name ?? '',
      last_name: o.last_name ?? '',
      phone: o.phone ?? '',
      city: o.city ?? '',
      province: o.province ?? '',
      total: o.total ?? 0,
      items: (o.items ?? []) as never,
      pay_method: o.pay_method ?? 'cod',
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to send email' };
  }
  if (!sent) {
    return { error: 'The email was not sent (provider skipped or rejected it). Check Emails → log for details.' };
  }
  await logAudit(session, { action: 'order.confirmation_resent', entity: 'order', entity_id: id, diff: { to: o.email } });
  revalidatePath(`/admin/orders/${id}`);
  return { success: true };
}

export async function bulkUpdateOrderStatus(ids: string[], status: OrderStatus): Promise<{ error?: string; count?: number }> {
  const session = await assertPermission('orders.edit');
  // orders RLS bars anon writes; service role is required for admin
  // mutations.
  const admin = supabaseAdmin();
  // Snapshot the prior state so we can (a) restock exactly the orders that
  // actually transition to cancelled — mirroring the single-order path in
  // updateOrderStatus — and (b) attribute the logged transitions to the
  // signed-in operator.
  const { data: beforeRows } = await admin
    .from('orders')
    .select('id, status, order_number, items')
    .in('id', ids);
  const before = (beforeRows ?? []) as Array<{ id: string; status: OrderStatus | null; order_number: string | null; items: unknown }>;

  const { error, count } = await admin
    .from('orders')
    .update({ status }, { count: 'exact' })
    .in('id', ids);
  if (error) return { error: error.message };

  const changed = before.filter(o => o.status !== status);
  await attributeOrderEvents(admin, changed.map(o => o.id), status, session);

  // Cancellation restock, same ledger path (and idempotency rule: only fires
  // on the transition, never on a "cancelled → cancelled" re-submit) as the
  // single-order cancel below.
  if (status === 'cancelled') {
    const toRestock = changed;
    for (const o of toRestock) {
      await restockCancelledOrder(admin, session, o);
    }
    if (toRestock.length > 0) revalidatePath('/admin/inventory');
  }

  revalidatePath('/admin/orders');
  return { count: count ?? ids.length };
}

export async function updateOrderStatus(
  id: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertPermission('orders.edit');
  const status = formData.get('status') as OrderStatus;

  // Read current state so we can detect transitions, email the customer,
  // and (for cancellation) restock the items. Both reads and writes need
  // the service role under the post-070 RLS.
  const admin = supabaseAdmin();
  const { data: before } = await admin
    .from('orders')
    .select('status, email, first_name, order_number, items, tracking_number, courier')
    .eq('id', id)
    .single();

  // Tracking number + courier are owned exclusively by the Shipment
  // section (the `shipments` table syncs them onto `orders` via trigger).
  // This action only moves order status, writing tracking here would
  // null out a booked shipment whenever the merchant changes status.
  const { error } = await admin
    .from('orders')
    .update({ status })
    .eq('id', id);
  if (error) return { error: error.message };

  // Attribute the transition the order_events trigger just logged to the
  // signed-in operator (the trigger can only stamp a generic 'staff').
  if (before && before.status !== status) {
    await attributeOrderEvents(admin, [id], status, session);
  }

  // Cancellation restock: when an order moves from a non-cancelled state to
  // cancelled, push the items back into stock via the inventory ledger (see
  // restockCancelledOrder). Idempotency: only fires on the transition, not
  // on a no-op "cancelled → cancelled" submit.
  if (before && before.status !== 'cancelled' && status === 'cancelled') {
    await restockCancelledOrder(admin, session, { id, order_number: before.order_number, items: before.items });
    revalidatePath('/admin/inventory');
  }

  // Fire-and-forget transition emails. The status trigger logs the change to
  // order_events; here we only handle the customer-facing notification.
  if (before && before.status !== status && before.email) {
    const { sendShippedEmail, sendDeliveredEmail, sendCancelledEmail } = await import('@/lib/email');
    const args = {
      email: before.email,
      first_name: before.first_name ?? 'there',
      order_number: before.order_number,
    };
    if (status === 'shipped') {
      void sendShippedEmail({ ...args, tracking_number: before.tracking_number ?? undefined, courier: before.courier ?? undefined });
    } else if (status === 'delivered') {
      void sendDeliveredEmail(args);
    } else if (status === 'cancelled') {
      void sendCancelledEmail(args);
    }
  }

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin/orders');
  return { success: true };
}

// NOTE: this file must export ONLY async server actions. A previous sync
// re-export of `hashPassword` (unused — the team actions import it from
// lib/staff-auth directly) stopped Turbopack from registering this module's
// actions for pages that pass them to client components as props, which
// 404'd the "Delete order" button with "Server action not found". Don't
// re-add non-action exports here.
