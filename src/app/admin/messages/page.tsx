export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DotChip } from '@/components/admin/OrderChips';
import { EmptyState } from '@/components/admin/EmptyState';
import { MessagesSearch } from '@/components/admin/MessagesSearch';
import { ReplyComposer } from './ReplyComposer';
import { markThreadRead, archiveThread, restoreThread } from './actions';
import { PK_TZ } from '@/lib/dates';

const fmt = (s: string) =>
  new Date(s).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: PK_TZ,
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

function ThreadActionButton({ action, email, label }: {
  action: (fd: FormData) => void; email: string; label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button type="submit" className="adm-btn adm-btn-secondary">{label}</button>
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

export default async function MessagesPage({ searchParams }: { searchParams?: Promise<{ error?: string; q?: string; t?: string }> }) {
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

  const allConvos = groupConversations(((data ?? []) as Row[]).slice().reverse());

  // Thread search: case-insensitive substring match on name / email / subject,
  // applied to the built conversation list before rendering.
  const q = (sp.q ?? '').trim().toLowerCase();
  const convos = q
    ? allConvos.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.includes(q) ||
        (c.subject ?? '').toLowerCase().includes(q))
    : allConvos;
  const open = convos.filter(c => !c.archived);
  const archived = convos.filter(c => c.archived);
  const unreadThreads = open.filter(c => c.unread > 0).length;

  // List/detail split: ?t=<email> selects a thread; desktop defaults to the
  // newest open one so the pane is never blank. On phones the two panes
  // become screens — the list when nothing is explicitly selected, the
  // conversation (with a back link) when it is. `explicit` drives that.
  const explicit = (sp.t ?? '').trim().toLowerCase();
  const selected =
    convos.find(c => c.email === explicit) ?? open[0] ?? archived[0] ?? null;

  // Customer context for the selected thread only (was one giant .in() query
  // across every thread's email — the other headers were never visible).
  let ctx: CustomerContext | undefined;
  if (selected) {
    const { data: orderRows } = await supabaseAdmin()
      .from('orders')
      .select('email, order_number, status, total, created_at')
      .ilike('email', selected.email)
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    const rows = (orderRows ?? []) as Array<{ order_number: string; status: string; total: number | null }>;
    if (rows.length > 0) {
      ctx = {
        orders: rows.length,
        total: rows.reduce((s, o) => s + Number(o.total ?? 0), 0),
        last: { order_number: rows[0].order_number, status: rows[0].status },
      };
    }
  }

  // Hrefs preserve the search when switching threads.
  const threadHref = (email: string) => {
    const p = new URLSearchParams();
    if (sp.q) p.set('q', sp.q);
    p.set('t', email);
    return `/admin/messages?${p.toString()}`;
  };
  const listHref = sp.q ? `/admin/messages?q=${encodeURIComponent(sp.q)}` : '/admin/messages';

  function ThreadListItem({ c }: { c: Convo }) {
    const last = c.messages[c.messages.length - 1];
    const active = selected?.email === c.email;
    return (
      <Link
        href={threadHref(c.email)}
        style={{
          display: 'block', padding: '12px 14px', textDecoration: 'none',
          borderLeft: `3px solid ${active ? '#C5286A' : 'transparent'}`,
          background: active ? '#fdf2f8' : 'transparent',
          borderBottom: '1px solid #f3f4f6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {c.unread > 0 && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C5286A', flexShrink: 0 }} />}
          <span style={{
            fontSize: '0.8438rem', color: '#111827', fontWeight: c.unread > 0 ? 700 : 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
          }}>
            {c.name}
          </span>
          <span style={{ fontSize: '0.6875rem', color: '#9ca3af', flexShrink: 0 }}>{fmt(c.lastAt)}</span>
        </div>
        <div style={{
          marginTop: 3, fontSize: '0.75rem', color: c.unread > 0 ? '#374151' : '#9ca3af',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {last.direction === 'outbound' ? 'You: ' : ''}{last.message}
        </div>
      </Link>
    );
  }

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      {/* Phone behaviour for the split: list OR conversation, not both. */}
      <style>{`
        @media (max-width: 767px) {
          .adm-msg-split { grid-template-columns: 1fr !important; }
          .adm-msg-split[data-view="detail"] .adm-msg-list { display: none !important; }
          .adm-msg-split[data-view="list"] .adm-msg-detail { display: none !important; }
          .adm-msg-back { display: inline-flex !important; }
        }
      `}</style>

      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Messages</h1>
      <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '0.875rem' }}>
        Conversations from the contact form and inbound email, threaded by customer. Reply here and it sends from your
        store address, the whole exchange stays on record.
      </p>

      {sp.error && (
        <div role="status" style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
        }}>{sp.error}</div>
      )}

      <div
        className="adm-msg-split"
        data-view={explicit ? 'detail' : 'list'}
        style={{
          display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 20,
          alignItems: 'start', maxWidth: 1200,
        }}
      >
        {/* ── Thread list ── */}
        <div className="adm-msg-list" style={{
          background: 'white', borderRadius: 12, border: '1px solid #f0f0f3',
          boxShadow: '0 1px 2px rgba(16,24,40,0.05)', overflow: 'hidden',
          position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
            <Suspense fallback={null}>
              <MessagesSearch />
            </Suspense>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>Inbox</span>
              {unreadThreads > 0 && <DotChip label={`${unreadThreads} unread`} color="#C5286A" />}
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#9ca3af' }}>
                {open.length} open{archived.length ? ` · ${archived.length} archived` : ''}
              </span>
            </div>
          </div>
          <div style={{ overflowY: 'auto' }}>
            {open.length === 0 && archived.length === 0 ? (
              <EmptyState compact icon="inbox" title={q ? 'No matching conversations' : 'No conversations yet'}>
                {q ? 'Try a different name, email or subject.' : 'Contact-form submissions and inbound emails will thread here by customer.'}
              </EmptyState>
            ) : (
              <>
                {open.map(c => <ThreadListItem key={c.email} c={c} />)}
                {archived.length > 0 && (
                  <>
                    <div style={{ padding: '8px 14px', fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f9fafb' }}>
                      Archived
                    </div>
                    {archived.map(c => <ThreadListItem key={c.email} c={c} />)}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Conversation ── */}
        <div className="adm-msg-detail" style={{ minWidth: 0 }}>
          {!selected ? (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #f0f0f3' }}>
              <EmptyState icon="inbox" title="No conversation selected">
                Pick a thread from the list to read and reply.
              </EmptyState>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #f0f0f3', boxShadow: '0 1px 2px rgba(16,24,40,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Link
                  href={listHref}
                  className="adm-msg-back"
                  style={{ display: 'none', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}
                >
                  ← Inbox
                </Link>
                {selected.unread > 0 && <DotChip label={`${selected.unread} new`} color="#C5286A" />}
                <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{selected.name}</span>
                <a href={`mailto:${selected.email}`} style={{ fontSize: '0.8125rem', color: '#C5286A', textDecoration: 'none' }}>{selected.email}</a>
                <DotChip label={selected.source === 'email' ? 'Email' : 'Form'} color="#6b7280" />
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {!selected.archived && selected.unread > 0 && (
                    <ThreadActionButton action={markThreadRead} email={selected.email} label="Mark read" />
                  )}
                  {selected.archived
                    ? <ThreadActionButton action={restoreThread} email={selected.email} label="Restore" />
                    : <ThreadActionButton action={archiveThread} email={selected.email} label="Archive" />}
                </span>
                {/* Customer context: order history at a glance. Links to the
                    orders list pre-filtered to this email. */}
                <span style={{ flexBasis: '100%', fontSize: '0.75rem', color: '#6b7280' }}>
                  {ctx && ctx.orders > 0 ? (
                    <Link href={`/admin/orders?q=${encodeURIComponent(selected.email)}`} style={{ color: '#6b7280', textDecoration: 'none' }}>
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
                {selected.messages.map(m => <Bubble key={m.id} m={m} />)}
                {!selected.archived && <ReplyComposer email={selected.email} name={selected.name} subject={selected.subject ?? ''} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
