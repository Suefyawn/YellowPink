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

/** Sent AFTER the customer confirms — thanks + the refusal-deterrent note.
 *  Deliberately not part of the confirmation ask above: the owner's call
 *  (10 Aug 2026) is that the note must never discourage a confirmation, so
 *  it rides on the acknowledgment instead. Wording is soft on purpose —
 *  "flagged", not "blacklisted": refused-once addresses have accepted
 *  redelivery, so the door stays open (advance payment / re-confirmation),
 *  and threat language screenshots badly for a beauty store. */
export function buildConfirmedThanksMessage(opts: {
  firstName?: string | null;
  orderNumber: string;
}): string {
  const first = (opts.firstName ?? '').trim();
  return [
    `Shukriya${first ? ` ${first}` : ''}! Aap ka order (${opts.orderNumber}) confirm ho gaya hai — hum dispatch ki tayari shuru kar rahe hain.`,
    '',
    'Aik choti si guzarish: parcel aane par receive zaroor kar lein. Confirm hone ke baad jo parcel receive nahi hota, us ka poora courier kharcha store ko bharna parta hai — is liye aise address system mein flag ho jate hain, aur wahan aainda COD order se pehle advance payment ya dobara confirmation ki zaroorat par sakti hai.',
    '',
    'Umeed hai aap ko apna order pasand aaye ga. Kisi bhi sawal ke liye yahin message kar dein!',
  ].join('\n');
}
