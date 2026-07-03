// Customer-facing transition emails for order status changes, shared by the
// single-order status action, the bulk status action and the shipment-booking
// path so the three can never drift (the bulk path used to silently skip
// these emails entirely).

import type { OrderStatus } from '@/types';

export interface StatusEmailOrder {
  email: string | null;
  first_name: string | null;
  order_number: string;
  tracking_number?: string | null;
  courier?: string | null;
}

// Lazy-load the email module (it constructs the Resend client at import
// time) exactly once; concurrent senders share the same in-flight promise.
let emailModule: Promise<typeof import('@/lib/email')> | null = null;
const getEmailModule = () => (emailModule ??= import('@/lib/email'));

/** Send the transition email for a status change (shipped / delivered /
 *  cancelled; other statuses are a no-op). Never throws — these are
 *  best-effort notifications and must not fail the mutation that triggered
 *  them. */
export async function sendStatusTransitionEmail(order: StatusEmailOrder, status: OrderStatus): Promise<void> {
  if (!order.email) return;
  try {
    const { sendShippedEmail, sendDeliveredEmail, sendCancelledEmail } = await getEmailModule();
    const args = {
      email: order.email,
      first_name: order.first_name ?? 'there',
      order_number: order.order_number,
    };
    if (status === 'shipped') {
      await sendShippedEmail({
        ...args,
        tracking_number: order.tracking_number ?? undefined,
        courier: order.courier ?? undefined,
      });
    } else if (status === 'delivered') {
      await sendDeliveredEmail(args);
    } else if (status === 'cancelled') {
      await sendCancelledEmail(args);
    }
  } catch {
    // Best-effort; the email module logs its own failures.
  }
}

/** Bulk variant: transition emails for many orders with capped concurrency
 *  (default 5 in flight) so a 200-order bulk update doesn't burst the email
 *  provider. Never throws. */
export async function sendStatusTransitionEmails(
  orders: StatusEmailOrder[],
  status: OrderStatus,
  concurrency = 5,
): Promise<void> {
  const queue = [...orders];
  const worker = async () => {
    for (let o = queue.shift(); o; o = queue.shift()) {
      await sendStatusTransitionEmail(o, status);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}
