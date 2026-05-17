// WooCommerce customers → Supabase auth.users + public.profiles + public.addresses.
//
// Passwords are NOT migrated (WP uses phpass; Supabase uses bcrypt). Each
// customer's auth row is created via the admin API with email_confirm=true
// but no password set — they reset via Supabase's "forgot password" flow
// at first login.

import { wc } from '../wp';
import { sb, upsertBatched } from '../sb';
import { CONFIG } from '../config';

interface WcAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

interface WcCustomer {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  billing?: WcAddress;
  shipping?: WcAddress;
}

// Look up or create a Supabase auth user for the given email. Returns the
// user's uuid, plus a boolean indicating whether we created them now.
async function ensureAuthUser(email: string): Promise<{ id: string; created: boolean }> {
  // Admin API: list by email.
  const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
  // listUsers doesn't accept a filter on every version; do a server-side
  // check by trying to invite — but easier: try createUser; if it fails with
  // "already registered", look up by listing all (slow but correct).
  // Best path: createUser with email; catch dup; then resolve via getUserByEmail-style query.
  if (CONFIG.dryRun) return { id: 'dryrun', created: true };

  // Try create — Supabase auth admin will reject duplicates.
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { wp_migrated: true },
  });
  if (!createErr && created?.user) {
    return { id: created.user.id, created: true };
  }

  // Resolve duplicate by paginating list — keep it bounded.
  void existing;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users || data.users.length === 0) break;
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return { id: hit.id, created: false };
    if (data.users.length < 200) break;
  }
  throw new Error(`could not create or find auth user for ${email}: ${createErr?.message ?? 'unknown'}`);
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const customers: WcCustomer[] = [];
  for await (const c of wc.paginate<WcCustomer>('/customers', { per_page: 100, role: 'all' })) {
    if (!c.email) continue;
    customers.push(c);
  }

  let imported = 0;
  let skipped = 0;

  for (const c of customers) {
    try {
      const { id: userId } = await ensureAuthUser(c.email);

      // Upsert profile keyed on (legacy_wp_user_id) so re-runs are stable.
      const profile = {
        id: userId,                 // PK = auth.users.id
        legacy_wp_user_id: c.id,
        first_name: c.first_name || c.billing?.first_name || null,
        last_name:  c.last_name  || c.billing?.last_name  || null,
        phone:      c.billing?.phone || null,
      };
      const r = await upsertBatched('profiles', [profile], { onConflict: 'id' });
      errors.push(...r.errors);
      imported += r.inserted;

      // Save the billing + shipping addresses if present.
      const addrs: Record<string, unknown>[] = [];
      const mkAddr = (a: WcAddress, label: string, def: boolean) => ({
        user_id:    userId,
        label,
        first_name: a.first_name || c.first_name || '',
        last_name:  a.last_name  || c.last_name  || '',
        phone:      a.phone || c.billing?.phone || '',
        line1:      a.address_1 || '',
        line2:      a.address_2 || null,
        city:       a.city || '',
        province:   a.state || null,
        zip:        a.postcode || null,
        is_default: def,
      });
      if (c.billing?.address_1)  addrs.push(mkAddr(c.billing,  'Billing',  true));
      if (c.shipping?.address_1 && c.shipping.address_1 !== c.billing?.address_1) {
        addrs.push(mkAddr(c.shipping, 'Shipping', false));
      }
      if (addrs.length && !CONFIG.dryRun) {
        // Clear existing addresses for this user so re-runs don't accumulate dupes.
        await sb.from('addresses').delete().eq('user_id', userId);
        const ar = await upsertBatched('addresses', addrs, {});
        errors.push(...ar.errors);
      }
    } catch (err) {
      errors.push(`customer ${c.email}: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }
  return { imported, skipped, errors };
}
