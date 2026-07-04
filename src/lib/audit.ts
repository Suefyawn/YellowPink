// Thin helper for writing audit_log rows from server actions. Best-effort:
// never throws (a failed audit insert mustn't block the actual write that
// already succeeded).
//
// Uses the service-role client because audit_log RLS is enabled with no
// anon INSERT policy (migration 064 / 070 hardening). The previous
// anon-client insert silently failed and the empty try/catch hid it, // the audit table sat at 0 rows for the full lifetime of the audit
// instrumentation. Service role is the right credential for an
// internal infra write that doesn't belong to a Supabase Auth user.

import { headers } from 'next/headers';
import { after } from 'next/server';
import { supabaseAdmin } from './supabase';
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

    const row = {
      actor_kind:  session?.isOwner ? 'owner' : session ? 'staff' : 'system',
      actor_id:    session?.id ?? null,
      actor_email: session?.email ?? null,
      action:      event.action,
      entity:      event.entity ?? null,
      entity_id:   event.entity_id ?? null,
      diff:        event.diff ?? null,
      ip,
      user_agent:  ua,
    };

    const insert = async () => {
      try {
        await supabaseAdmin().from('audit_log').insert(row);
      } catch { /* audit logging must never throw */ }
    };

    // Call sites fire this without awaiting (`void logAudit(...)`) right
    // before a redirect/return; on Vercel the lambda freezes with the
    // response and an un-awaited insert could be dropped. after() keeps the
    // function alive until the callback settles, so every audit row lands
    // without the mutation waiting on it. Falls back to a direct await when
    // there's no request scope to attach to (e.g. cron/scripts).
    try {
      after(insert);
    } catch {
      await insert();
    }
  } catch {
    // intentional: audit logging must never throw.
  }
}
