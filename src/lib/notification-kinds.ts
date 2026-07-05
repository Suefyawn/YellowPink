import { can, type Permission } from '@/lib/permissions';
import type { StaffSession } from '@/lib/permissions';

// Notification kinds are filtered against the viewer's permissions so a
// marketer doesn't see Sentry stack-trace alerts, an inventory manager
// doesn't see customer-PII pings, etc. Owners see everything.
//
// `null` means anyone can see this kind. Shared by the admin layout (feed
// filtering) and notifications-actions (so "mark all read" can't clear
// notifications the clicker isn't allowed to see).
export const KIND_PERMISSION: Record<string, Permission | null> = {
  new_order:      'orders.view',
  low_stock:      'products.view',
  payment_failed: 'orders.view',
  return_request: 'returns',
  new_review:     'reviews',
  new_message:    'messages',
  staff_added:    null,           // visible to all signed-in staff
  sentry_issue:   'analytics_errors',
  posthog_spike:  'analytics_traffic',
  posthog_drop:   'analytics_traffic',
  abandoned_cart: 'orders.view',
};

/** Kinds this session may see. `null` = unrestricted (owner). */
export function visibleNotificationKinds(session: StaffSession): string[] | null {
  if (session.isOwner) return null;
  return Object.entries(KIND_PERMISSION)
    .filter(([, required]) => required === null || can(session, required))
    .map(([kind]) => kind);
}
