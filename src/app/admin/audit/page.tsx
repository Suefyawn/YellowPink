export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

interface AuditRow {
  id: string;
  actor_kind: 'owner' | 'staff' | 'system';
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export default async function AuditPage() {
  const session = await getStaffSession();
  if (!session?.isOwner) {
    return <NoAccess section="Audit log" />;
  }

  const { data } = await supabase
    .from('audit_log')
    .select('id, actor_kind, actor_email, action, entity, entity_id, diff, ip, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as AuditRow[];

  return (
    <div style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Audit log</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Last 200 admin actions. Owner-only.
      </p>

      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>No audit events yet.</div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['When', 'Actor', 'Action', 'Entity', 'IP', 'Diff'].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="When" style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: '#6b7280', fontSize: '0.75rem' }}>
                    {new Date(r.created_at).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td data-label="Actor" style={{ padding: '10px 16px', color: '#111827' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: r.actor_kind === 'owner' ? '#ec4899' : r.actor_kind === 'staff' ? '#3b82f6' : '#6b7280', textTransform: 'uppercase' }}>
                      {r.actor_kind}
                    </span>
                    {r.actor_email && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{r.actor_email}</div>}
                  </td>
                  <td data-label="Action" style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#374151', whiteSpace: 'nowrap' }}>{r.action}</td>
                  <td data-label="Entity" style={{ padding: '10px 16px', fontSize: '0.75rem', color: '#374151', whiteSpace: 'nowrap' }}>
                    {r.entity ? `${r.entity}${r.entity_id ? ` ${r.entity_id.slice(0, 8)}…` : ''}` : '—'}
                  </td>
                  <td data-label="IP" style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.6875rem', color: '#6b7280' }}>{r.ip ?? '—'}</td>
                  <td data-label="Diff" style={{ padding: '10px 16px', fontSize: '0.6875rem', color: '#374151' }}>
                    {r.diff ? <details><summary style={{ cursor: 'pointer' }}>view</summary><pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', maxWidth: 360 }}>{JSON.stringify(r.diff, null, 2)}</pre></details> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
