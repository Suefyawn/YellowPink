'use client';

import { useMemo, useState } from 'react';

export interface Subscriber {
  id: string;
  email: string;
  source: string;
  unsubscribed_at: string | null;
  created_at: string;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

// Source values stored by the signup flows ('footer', 'modal', 'checkout', …) —
// shown as a friendlier label where one is known.
const SOURCE_LABEL: Record<string, string> = {
  footer: 'Footer form',
  modal: 'Popup',
  checkout: 'Checkout',
};

type StatusFilter = 'all' | 'active' | 'unsubscribed';

export function SubscriberList({ subscribers }: { subscribers: Subscriber[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const activeTotal = useMemo(
    () => subscribers.filter(s => !s.unsubscribed_at).length,
    [subscribers],
  );
  const unsubTotal = subscribers.length - activeTotal;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return subscribers.filter(s => {
      if (status === 'active' && s.unsubscribed_at) return false;
      if (status === 'unsubscribed' && !s.unsubscribed_at) return false;
      if (needle && !s.email.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [subscribers, q, status]);

  const chip = (key: StatusFilter): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
    cursor: 'pointer', border: '1px solid',
    borderColor: status === key ? '#C5286A' : '#e5e7eb',
    background: status === key ? '#fdf2f8' : 'white',
    color: status === key ? '#9d174d' : '#6b7280',
  });

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 28 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Subscribers</h2>
        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
          <strong style={{ color: '#111827' }}>{activeTotal}</strong> active
          {unsubTotal > 0 && <> · {unsubTotal} unsubscribed</>}
        </span>
      </div>

      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by email…"
          style={{
            flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8,
            border: '1px solid #d1d5db', fontSize: '0.875rem', color: '#111827',
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={chip('all')} onClick={() => setStatus('all')}>All</button>
          <button type="button" style={chip('active')} onClick={() => setStatus('active')}>Active</button>
          <button type="button" style={chip('unsubscribed')} onClick={() => setStatus('unsubscribed')}>Unsubscribed</button>
        </div>
      </div>

      {subscribers.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No subscribers yet — sign-ups from the footer, popup, and checkout will appear here.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No subscribers match this search.
        </div>
      ) : (
        <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Email', 'Source', 'Status', 'Subscribed'].map(h => (
                <th key={h} scope="col" style={{ padding: '11px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const active = !s.unsubscribed_at;
              return (
                <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td data-label="Email" style={{ padding: '12px 20px', fontSize: '0.875rem', fontWeight: 500, color: '#111827', wordBreak: 'break-all' }}>
                    {s.email}
                  </td>
                  <td data-label="Source" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#6b7280' }}>
                    {SOURCE_LABEL[s.source] ?? s.source}
                  </td>
                  <td data-label="Status" style={{ padding: '12px 20px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 9px', borderRadius: 999,
                      fontSize: '0.6875rem', fontWeight: 700,
                      background: active ? '#dcfce7' : '#f3f4f6',
                      color: active ? '#166534' : '#6b7280',
                    }}>
                      {active ? 'Subscribed' : 'Unsubscribed'}
                    </span>
                  </td>
                  <td data-label="Subscribed" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {fmtDate(s.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
