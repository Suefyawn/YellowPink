export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { ReturnsQueue } from '@/components/admin/ReturnsQueue';

interface ReturnRow {
  id: string;
  order_id: string;
  user_id: string | null;
  email: string | null;
  reason: string;
  items: { product_id: string; qty: number; name: string; price: number }[];
  status: 'pending' | 'approved' | 'rejected' | 'received' | 'refunded' | 'cancelled';
  refund_amount: number | null;
  refund_method: 'store_credit' | 'coupon' | 'original' | 'cod_deduct' | null;
  admin_note: string | null;
  created_at: string;
}

export default async function ReturnsPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('orders')) {
    return <NoAccess section="Returns" />;
  }

  const { data } = await supabase
    .from('return_requests')
    .select('id, order_id, user_id, email, reason, items, status, refund_amount, refund_method, admin_note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as ReturnRow[];

  // Pull order numbers for display.
  const orderIds = Array.from(new Set(rows.map(r => r.order_id)));
  const { data: orderRows } = await supabase
    .from('orders').select('id, order_number, first_name, last_name, total').in('id', orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000']);
  const orderMap = new Map<string, { order_number: string; first_name: string; last_name: string; total: number }>();
  for (const o of (orderRows ?? []) as Array<{ id: string; order_number: string; first_name: string; last_name: string; total: number }>) {
    orderMap.set(o.id, o);
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Returns</h1>
        <Link href="/admin/orders" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>← All orders</Link>
      </div>

      <ReturnsQueue rows={rows} orderMap={Object.fromEntries(orderMap)} />
    </div>
  );
}
