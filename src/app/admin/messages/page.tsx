export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { ReplyComposer } from './ReplyComposer';
import { markThreadRead, archiveThread, restoreThread } from './actions';

const fmt = (s: string) =>
  new Date(s).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });

interface Row {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: 'new' | 'read' | 'archived';
  source: string | null;
  direction: 'inbound' | 'outbound';
  created_at: string;
}

interface Convo {
  email: string;
  name: string;
  subject: string | null;
  source: string | null;
  messages: Row[];
  lastAt: string;
  unread: number;
  archived: boolean;
}

const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
  padding: '6px 12px', background: bg, color, border: 'none', borderRadius: 6,
  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
});

function ThreadActionButton({ action, email, label, bg, color }: {
  action: (fd: FormData) => void; email: string; label: string; bg: string; color?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button type="submit" style={btn(bg, color)}>{label}</button>
    </form>
  );
}

function Bubble({ m }: { m: Row }) {
  const out = m.direction === 'outbound';
  return (
    <div style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div style={{ maxWidth: '80%' }}>
        <div style={{
          padding: '10px 14px', borderRadius: 12,
          background: out ? '#fce7f3' : '#f3f4f6',
          border: `1px solid ${out ? '#f9cfe3' : '#eceef1'}`,
          borderBottomRightRadius: out ? 4 : 12, borderBottomLeftRadius: out ? 12 : 4,
        }}>
          {m.subject && !out && (
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111827', marginBottom: 4 }}>{m.subject}</div>
          )}
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.message}</p>
        </div>
        <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 3, textAlign: out ? 'right' : 'left' }}>
          {out ? 'Yellow Pink' : m.name} · {fmt(m.created_at)}
        </div>
      </div>
    </div>
  );
}

/** Order history rolled up per customer email, shown in the thread header so
 *  support can see who they're talking to without leaving the inbox. */
interface CustomerContext {
  orders: number;
  total: number;
  last: { order_number: string; status: string } | null;
}

function Conversation({ c, ctx }: { c: Convo; ctx?: CustomerContext }) {
  const mailHref = `mailto:${c.email}`;
  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #f0f0f3', boxShadow: '0 1px 2px rgba(16,24,40,0.05)', marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {c.unread > 0 && (
          <span style={{ background: '#fce7f3', color: '#9d174d', borderRadius: 20, padding: '2px 8px', fontSize: '0.6875rem', fontWeight: 700 }}>
            {c.unread} new
          </span>
        )}
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{c.name}</span>
        <a href={mailHref} style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>{c.email}</a>
        <span style={{ background: '#eef2f6', color: '#475569', borderRadius: 20, padding: '2px 8px', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {c.source === 'email' ? 'Email' : 'Form'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!c.archived && c.unread > 0 && (
            <ThreadActionButton action={markThreadRead} email={c.email} label="Mark read" bg="#10b981" />
          )}
          {c.archived
            ? <ThreadActionButton action={restoreThread} email={c.email} label="Restore" bg="#f3f4f6" color="#374151" />
            : <ThreadActionButton action={archiveThread} email={c.email} label="Archive" bg="#f3f4f6" color="#374151" />}
        </span>
        {/* Customer context: order history at a glance. Links to the orders
            list pre-filtered to this email. */}
        <span style={{ flexBasis: '100%', fontSize: '0.75rem', color: '#6b7280' }}>
          {ctx && ctx.orders > 0 ? (
            <Link href={`/admin/orders?q=${encodeURIComponent(c.email)}`} style={{ color: '#6b7280', textDecoration: 'none' }}>
              {ctx.orders} order{ctx.orders !== 1 ? 's' : ''} · PKR {Math.round(ctx.total).toLocaleString()}
              {ctx.last ? ` · last: ${ctx.last.order_number} (${ctx.last.status})` : ''}
              <span style={{ color: '#C5286A' }}> →</span>
            </Link>
          ) : (
            <span style={{ color: '#9ca3af' }}>No orders under this email</span>
          )}
        </span>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {c.messages.map(m => <Bubble key={m.id} m={m} />)}
        {!c.archived && <ReplyComposer email={c.email} name={c.name} subject={c.subject ?? ''} />}
      </div>
    </div>
  );
}

function groupConversations(rows: Row[]): Convo[] {
  const byEmail = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.email.toLowerCase();
    (byEmail.get(key) ?? byEmail.set(key, []).get(key)!).push(r);
  }
  const convos: Convo[] = [];
  for (const [email, msgs] of byEmail) {
    msgs.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const firstInbound = msgs.find(m => m.direction === 'inbound');
    convos.push({
      email,
      name: firstInbound?.name || msgs[0].name || email,
      subject: firstInbound?.subject ?? null,
      source: firstInbound?.source ?? msgs[0].source ?? null,
      messages: msgs,
      lastAt: msgs[msgs.length - 1].created_at,
      unread: msgs.filter(m => m.direction === 'inbound' && m.status === 'new').length,
      archived: msgs.every(m => m.status === 'archived'),
    });
  }
  return convos.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export default async function MessagesPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const session = await getStaffSession();
  // No session must NOT fall through: the edge gate only checks that a
  // staff_session cookie exists (real verification happens here), so a
  // forged cookie reaches this page with session=null.
  if (!session || (!session.isOwner && !session.permissions.includes('messages'))) {
    return <NoAccess section="Messages" />;
  }
  const sp = (await searchParams) ?? {};

  // Newest-first within the cap, then restored to chronological order for
  // threading: ascending+limit would keep the OLDEST 2,000 rows and silently
  // drop every new inbound message once the table outgrows the cap.
  const { data } = await supabaseAdmin()
    .from('contact_messages')
    .select('id, name, email, subject, message, status, source, direction, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);

  const convos = groupConversations(((data ?? []) as Row[]).slice().reverse());
  const open = convos.filter(c => !c.archived);
  const archived = convos.filter(c => c.archived);
  const unreadThreads = open.filter(c => c.unread > 0).length;

  // Customer context: one orders query for every thread's email (raw + lower
  // case variants, since checkout emails aren't normalised), rolled up per
  // customer for the thread headers.
  const emailVariants = new Set<string>();
  for (const c of convos) { emailVariants.add(c.email); emailVariants.add(c.email.toLowerCase()); }
  const ctxByEmail = new Map<string, { orders: number; total: number; last: { order_number: string; status: string } | null }>();
  if (emailVariants.size > 0) {
    const { data: orderRows } = await supabaseAdmin()
      .from('orders')
      .select('email, order_number, status, total, created_at')
      .in('email', [...emailVariants])
      .order('created_at', { ascending: false });
    for (const o of (orderRows ?? []) as Array<{ email: string | null; order_number: string; status: string; total: number | null; created_at: string }>) {
      const key = (o.email ?? '').toLowerCase();
      const cur = ctxByEmail.get(key) ?? { orders: 0, total: 0, last: null };
      cur.orders += 1;
      cur.total += Number(o.total ?? 0);
      // Rows arrive newest-first, so the first one seen is the latest order.
      if (!cur.last) cur.last = { order_number: o.order_number, status: o.status };
      ctxByEmail.set(key, cur);
    }
  }

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 860 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Messages</h1>
      <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: '0.875rem' }}>
        Conversations from the contact form and inbound email, threaded by customer. Reply here and it sends from your
        store address, the whole exchange stays on record.
      </p>

      {sp.error && (
        <div role="status" style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
        }}>{sp.error}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Inbox</h2>
        {unreadThreads > 0 && (
          <span style={{ background: '#fce7f3', color: '#9d174d', borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
            {unreadThreads} unread
          </span>
        )}
      </div>
      {open.length === 0
        ? <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', background: 'white', borderRadius: 12, border: '1px solid #f0f0f3', marginBottom: 16 }}>No conversations yet.</div>
        : open.map(c => <Conversation key={c.email} c={c} ctx={ctxByEmail.get(c.email)} />)}

      {archived.length > 0 && (
        <>
          <h2 style={{ margin: '32px 0 14px', fontSize: '0.9375rem', fontWeight: 600, color: '#6b7280' }}>Archived</h2>
          {archived.map(c => <Conversation key={c.email} c={c} ctx={ctxByEmail.get(c.email)} />)}
        </>
      )}
    </div>
  );
}
