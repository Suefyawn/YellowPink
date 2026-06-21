export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DeleteButton } from '@/components/admin/DeleteButton';
import {
  markMessageRead,
  markMessageUnread,
  archiveMessage,
  restoreMessage,
  deleteMessage,
} from './actions';

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

interface MessageRow {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: 'new' | 'read' | 'archived';
  created_at: string;
}

const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
  padding: '6px 12px', background: bg, color, border: 'none', borderRadius: 6,
  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
});

function MessageCard({ m }: { m: MessageRow }) {
  const mailHref = `mailto:${m.email}?subject=${encodeURIComponent(
    m.subject ? `Re: ${m.subject}` : 'Re: your message to Yellow Pink',
  )}`;
  return (
    <div style={{ borderTop: '1px solid #f3f4f6', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        {m.status === 'new' && (
          <span style={{ background: '#fce7f3', color: '#9d174d', borderRadius: 20, padding: '2px 8px', fontSize: '0.6875rem', fontWeight: 700 }}>
            New
          </span>
        )}
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{m.name}</span>
        <a href={mailHref} style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>{m.email}</a>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{fmtDateTime(m.created_at)}</span>
      </div>
      {m.subject && (
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>{m.subject}</div>
      )}
      <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.message}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <a href={mailHref} style={{ ...btn('#C5286A'), textDecoration: 'none', display: 'inline-block' }}>Reply</a>
        {m.status === 'new' && (
          <form action={markMessageRead}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" style={btn('#10b981')}>Mark read</button>
          </form>
        )}
        {m.status === 'read' && (
          <form action={markMessageUnread}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" style={btn('#f3f4f6', '#374151')}>Mark unread</button>
          </form>
        )}
        {m.status === 'archived' ? (
          <form action={restoreMessage}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" style={btn('#f3f4f6', '#374151')}>Restore</button>
          </form>
        ) : (
          <form action={archiveMessage}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" style={btn('#f3f4f6', '#374151')}>Archive</button>
          </form>
        )}
        <DeleteButton id={m.id} action={deleteMessage} confirmMsg={`Delete the message from ${m.name}?`} />
      </div>
    </div>
  );
}

function Section({ title, count, rows, hint, empty }: {
  title: string; count?: number; rows: MessageRow[]; hint?: string; empty: string;
}) {
  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 32, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          {title}{hint && <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.875rem' }}> {hint}</span>}
        </h2>
        {count !== undefined && count > 0 && (
          <span style={{ background: '#fce7f3', color: '#9d174d', borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
            {count}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>{empty}</div>
      ) : (
        rows.map(m => <MessageCard key={m.id} m={m} />)
      )}
    </div>
  );
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('messages')) {
    return <NoAccess section="Messages" />;
  }
  const sp = (await searchParams) ?? {};

  // contact_messages has no anon SELECT policy (PII); the service role is the
  // right credential to read the inbox.
  const { data } = await supabaseAdmin()
    .from('contact_messages')
    .select('id, name, email, subject, message, status, created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  const all = (data ?? []) as MessageRow[];
  const unread = all.filter(m => m.status === 'new');
  const read = all.filter(m => m.status === 'read');
  const archived = all.filter(m => m.status === 'archived');

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Messages</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: '0.875rem' }}>
        Customer messages sent from the storefront contact form. Replies open your email app.
      </p>

      {sp.error && (
        <div role="status" style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
        }}>
          {sp.error}
        </div>
      )}

      <Section title="Unread" count={unread.length} rows={unread} empty="No new messages." />
      <Section title="Read" rows={read} empty="No read messages." />
      {archived.length > 0 && (
        <Section title="Archived" hint="(last 300)" rows={archived} empty="No archived messages." />
      )}
    </div>
  );
}
