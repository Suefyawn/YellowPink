'use server';

// Live-data search behind the ⌘K command palette. The palette's static
// commands cover navigation; this covers the operator's actual question —
// "take me to order YP-…", "open the CeraVe cleanser", "find Ayesha's
// account" — which is what makes the palette feel like a power tool instead
// of a fancier nav menu.
//
// Permission-scoped: each result group is searched only when the session
// holds the permission that gates the destination page, so a marketer
// without orders access never sees order matches (same rule the sidebar and
// the pages themselves apply). Null session → empty results, never an error:
// the palette degrades to nav-only rather than breaking.

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';

export interface PaletteHit {
  group: 'Orders' | 'Products' | 'Customers';
  label: string;
  hint: string;
  href: string;
}

const esc = (s: string) => s.replace(/[%_,()]/g, ' ').trim();

export async function paletteSearch(query: string): Promise<PaletteHit[]> {
  const q = esc(query);
  if (q.length < 2) return [];
  const session = await getStaffSession();
  if (!session) return [];

  const sb = supabaseAdmin();
  const like = `%${q}%`;
  // PromiseLike, not Promise: supabase query builders are thenables.
  const jobs: PromiseLike<PaletteHit[]>[] = [];

  if (session.isOwner || can(session, 'orders.view')) {
    jobs.push(
      sb.from('orders')
        .select('id, order_number, first_name, last_name, phone, total, status, archived_at')
        .or(`order_number.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => (data ?? []).map(o => ({
          group: 'Orders' as const,
          // Archived orders stay findable (search is a lookup tool, and the
          // Archived view is a legitimate destination) but are labelled so
          // nobody mistakes one for a live order.
          label: `${o.order_number} — ${[o.first_name, o.last_name].filter(Boolean).join(' ') || o.phone}`,
          hint: `PKR ${Number(o.total).toLocaleString()} · ${String(o.status).replaceAll('_', ' ')}${(o as { archived_at?: string | null }).archived_at ? ' · archived' : ''}`,
          href: `/admin/orders/${o.id}`,
        }))),
    );
  }

  if (session.isOwner || can(session, 'products.view')) {
    jobs.push(
      sb.from('products')
        .select('id, name, brand, price, status')
        .or(`name.ilike.${like},brand.ilike.${like}`)
        .order('name')
        .limit(5)
        .then(({ data }) => (data ?? []).map(p => ({
          group: 'Products' as const,
          label: [p.brand, p.name].filter(Boolean).join(' '),
          hint: `PKR ${Number(p.price).toLocaleString()}${p.status !== 'published' ? ` · ${p.status}` : ''}`,
          href: `/admin/products/${p.id}`,
        }))),
    );
  }

  if (session.isOwner || can(session, 'customers.view')) {
    jobs.push(
      sb.from('customer_profiles')
        .select('id, first_name, last_name, phone')
        .or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like}`)
        .limit(5)
        .then(({ data }) => (data ?? []).map(c => ({
          group: 'Customers' as const,
          label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.phone || 'Customer',
          hint: c.phone ?? '',
          href: `/admin/users/${c.id}`,
        }))),
    );
  }

  const settled = await Promise.allSettled(jobs);
  return settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
}
