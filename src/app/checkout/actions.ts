'use server';

import { sendNewOrderEmail } from '@/lib/email';

export async function notifyNewOrder(order: {
  order_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  city: string;
  province?: string;
  total: number;
  items: Array<{ name: string; qty: number; price: number }>;
  pay_method: string;
}) {
  await sendNewOrderEmail(order);
}
