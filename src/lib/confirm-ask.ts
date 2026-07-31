// Shared WhatsApp COD-confirmation message. Single source for the order
// page's "Send WhatsApp confirmation" button so wording can't drift if a
// queue surface is added later. Same Roman Urdu house voice as
// review-ask.ts: it's how the store actually talks to customers, and a
// personal ask gets replies where a formal English template gets ignored.
//
// Why this exists: July's returned orders were all COD refusals. A reply
// costs the customer nothing; a refused parcel costs the store the courier
// round trip. Confirm before dispatch, not after.

import { formatPkr } from '@/lib/commerce';

export function buildConfirmAskMessage(opts: {
  firstName?: string | null;
  orderNumber: string;
  /** Order line names, first one is named in the message. */
  itemNames: string[];
  total: number;
  city?: string | null;
}): string {
  const first = (opts.firstName ?? '').trim();
  const n = opts.itemNames.length;
  const itemsLabel =
    n === 0 ? 'aap ka order'
    : n === 1 ? opts.itemNames[0]
    : `${opts.itemNames[0]} aur ${n - 1} aur item${n - 1 > 1 ? 's' : ''}`;
  return [
    `Assalam-o-Alaikum${first ? ` ${first}` : ''}! Yellow Pink se.`,
    '',
    `Aap ka order (${opts.orderNumber}) mil gaya hai: ${itemsLabel}, total ${formatPkr(opts.total)}, cash on delivery${opts.city ? `, delivery ${opts.city} mein` : ''}.`,
    '',
    'Dispatch se pehle sirf ek confirmation chahiye: kya order theek hai? "YES" reply kar dein to hum aaj hi rawana kar dein.',
    '',
    'Agar address ya order mein kuch tabdeel karna ho to yahin bata dein. Shukriya!',
  ].join('\n');
}
