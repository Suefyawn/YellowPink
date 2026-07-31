// Multi-recipient internal notifications.
//
// Resolves the set of email addresses that should receive a given internal
// alert. The notification_recipients table is the source of truth; if no
// recipient subscribes to an event, falls back to OWNER_EMAIL so behaviour
// is unchanged for stores that haven't configured the new UI yet.
//
// All callers must be best-effort, a recipient lookup failure must never
// stall an order placement or block any other commit. On any error we fall
// back to OWNER_EMAIL too.

import { supabaseAdmin } from './supabase';
import { log } from './logger';

const FALLBACK_EMAIL = process.env.OWNER_EMAIL ?? 'sooviaan@gmail.com';

export type NotificationEvent = 'order.new' | 'seo.broken_links' | 'cart.abandoned';

export const NOTIFICATION_EVENTS: { key: NotificationEvent; label: string; desc: string }[] = [
  {
    key: 'order.new',
    // This subscription also carries customer contact-form messages and
    // medical-reviewer applications (they all fan out to the same recipient
    // list), so the label/description name every kind it actually delivers —
    // the copy previously promised only orders.
    label: 'New orders & customer messages',
    desc: 'Emails you when a customer places an order, sends a contact-form message, or a doctor applies to the medical review board.',
  },
  {
    key: 'seo.broken_links',
    label: 'Broken links (404s)',
    desc: 'Daily digest when a new URL starts returning 404 (e.g. a dead link a crawler or visitor hit).',
  },
  {
    key: 'cart.abandoned',
    label: 'Abandoned checkouts',
    desc: 'Emails you when a shopper leaves contact details at checkout but does not order (about an hour after they go quiet), with a one-tap WhatsApp link so you can follow up personally.',
  },
];

export interface NotificationRecipient {
  id: string;
  email: string;
  events: NotificationEvent[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Return the email addresses that should receive a given event.
 *  Always returns at least one address, falls back to OWNER_EMAIL when
 *  no recipient is configured or on any lookup error. */
export async function getRecipientsForEvent(event: NotificationEvent): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from('notification_recipients')
      .select('email')
      .eq('enabled', true)
      .contains('events', [event]);
    if (error) throw error;
    const recipients = (data ?? []).map((r: { email: string }) => r.email);
    return recipients.length > 0 ? recipients : [FALLBACK_EMAIL];
  } catch (err) {
    log.warn('notification.recipients.lookup_failed', {
      event,
      err: err instanceof Error ? err.message : String(err),
    });
    return [FALLBACK_EMAIL];
  }
}

/** List every recipient (any event, enabled or not). Admin UI only. */
export async function listAllRecipients(): Promise<NotificationRecipient[]> {
  const { data } = await supabaseAdmin()
    .from('notification_recipients')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as NotificationRecipient[];
}

/** Returns the resolved fallback email so the admin UI can show the owner
 *  exactly which address acts as the default when nobody is configured. */
export function fallbackRecipientEmail(): string {
  return FALLBACK_EMAIL;
}
