// Thin helper for writing audit_log rows from server actions. Best-effort:
// never throws (a failed audit insert mustn't block the actual write that
// already succeeded).

import { headers } from 'next/headers';
import { supabase } from './supabase';
import { ipFromHeaders } from './ratelimit';
import type { StaffSession } from './permissions';

export interface AuditEvent {
  action: string;                          // 'product.update', 'order.bulk_status_change', …
  entity?: string;
  entity_id?: string | null;
  diff?: Record<string, unknown>;
}

export async function logAudit(session: StaffSession | null, event: AuditEvent): Promise<void> {
  try {
    const h = await headers();
    const ip = ipFromHeaders(h);
    const ua = h.get('user-agent') ?? null;

    await supabase.from('audit_log').insert({
      actor_kind:  session?.isOwner ? 'owner' : session ? 'staff' : 'system',
      actor_id:    session?.id ?? null,
      actor_email: session?.email ?? null,
      action:      event.action,
      entity:      event.entity ?? null,
      entity_id:   event.entity_id ?? null,
      diff:        event.diff ?? null,
      ip,
      user_agent:  ua,
    });
  } catch {
    // intentional: audit logging must never throw.
  }
}
