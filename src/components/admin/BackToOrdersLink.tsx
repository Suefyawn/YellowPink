'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// "← Orders" link on the order-detail page that returns to the filtered /
// searched list the staffer came from (status pills, search, page) — read
// from the query OrdersFilter persisted to sessionStorage. Falls back to the
// plain list when there's nothing stored (e.g. deep-linked straight to an
// order).
export function BackToOrdersLink() {
  const [href, setHref] = useState('/admin/orders');

  useEffect(() => {
    try {
      const qs = sessionStorage.getItem('adminOrdersQuery');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (qs) setHref(`/admin/orders${qs}`);
    } catch { /* private mode */ }
  }, []);

  return (
    <Link href={href} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Orders</Link>
  );
}
