// Customer CSV export for ad-platform Custom Audiences (Meta / TikTok / Google).
// Outputs the columns those platforms accept for matching, email, phone, first
// name, last name, country, plus order count + spend for convenience. The
// platform hashes the PII on upload; we just hand over the plaintext CSV.
//
// Honours the same filters as the Customers page (?q, ?type, ?activity) so the
// owner can export a targeted seed audience (e.g. repeat buyers → lookalike).
// Admin-gated; never reachable by anon (service-role data + session check).

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import type { AdminUser } from '@/types';

export const dynamic = 'force-dynamic';

interface OrderStat { user_id: string; order_count: number | string; total_spent: number | string; }
interface GuestCustomer {
  guest_key: string; email: string | null; first_name: string | null; last_name: string | null;
  phone: string | null; order_count: number | string; total_spent: number | string;
}
interface Row {
  kind: 'registered' | 'guest';
  email: string; first_name: string | null; last_name: string | null; phone: string | null;
  orderCount: number; totalSpent: number;
}

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').toLowerCase().trim();
  const type = sp.get('type') ?? 'all';       // all | registered | guest
  const activity = sp.get('activity') ?? 'all'; // all | repeat | one | none

  const admin = supabaseAdmin();
  const [{ data: users }, { data: stats }, { data: guests }] = await Promise.all([
    admin.rpc('get_admin_users' as never),
    admin.rpc('get_customer_order_stats' as never),
    admin.rpc('get_guest_customers' as never),
  ]);

  const statById = new Map<string, OrderStat>();
  for (const st of (stats ?? []) as OrderStat[]) statById.set(st.user_id, st);

  const registered: Row[] = ((users ?? []) as AdminUser[]).map(u => {
    const st = statById.get(u.id);
    return {
      kind: 'registered', email: u.email, first_name: u.first_name, last_name: u.last_name, phone: u.phone,
      orderCount: st ? Number(st.order_count) : 0, totalSpent: st ? Number(st.total_spent) : 0,
    };
  });
  const guestRows: Row[] = ((guests ?? []) as GuestCustomer[]).map(g => ({
    kind: 'guest', email: g.email ?? '', first_name: g.first_name, last_name: g.last_name, phone: g.phone,
    orderCount: Number(g.order_count), totalSpent: Number(g.total_spent),
  }));

  let rows = [...registered, ...guestRows];
  if (type === 'registered' || type === 'guest') rows = rows.filter(r => r.kind === type);
  if (activity !== 'all') {
    rows = rows.filter(r =>
      activity === 'repeat' ? r.orderCount >= 2 :
      activity === 'one'    ? r.orderCount === 1 :
      /* none */              r.orderCount === 0);
  }
  if (q) {
    const qDigits = q.replace(/\D+/g, '');
    rows = rows.filter(r =>
      r.email?.toLowerCase().includes(q) ||
      `${r.first_name ?? ''} ${r.last_name ?? ''}`.toLowerCase().includes(q) ||
      (r.phone ?? '').toLowerCase().includes(q) ||
      (qDigits.length >= 3 && (r.phone ?? '').replace(/\D+/g, '').includes(qDigits)));
  }
  // A custom audience needs at least an email or phone to match on.
  rows = rows.filter(r => r.email || r.phone);

  const header = ['email', 'phone', 'first_name', 'last_name', 'country', 'orders', 'total_spent'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvCell(r.email), csvCell(r.phone), csvCell(r.first_name), csvCell(r.last_name),
      'PK', csvCell(r.orderCount), csvCell(Math.round(r.totalSpent)),
    ].join(','));
  }
  const csv = lines.join('\n');
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yellowpink-customers-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
