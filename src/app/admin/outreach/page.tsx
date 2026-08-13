export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { DotChip } from '@/components/admin/OrderChips';
import { PK_TZ } from '@/lib/dates';
import { approveAndSend, markStatus, saveDraft, sendReply, updateProspect } from './actions';

// Admin → Outreach: the backlink/press campaign desk. Pitches arrive here as
// editable drafts, go out from hello@yellowpink.pk on one deliberate click,
// and replies (received by the inbound-email webhook) thread onto the
// prospect, so the whole conversation lives on this page and no personal
// inbox is involved.

interface Prospect {
  id: string;
  domain: string;
  name: string | null;
  type: string;
  score: number | null;
  band: string | null;
  angle: string | null;
  asset: string | null;
  evidence: string | null;
  contact_email: string | null;
  contact_form_url: string | null;
  whatsapp: string | null;
  instagram: string | null;
  status: string;
  link_url: string | null;
  notes: string | null;
}

interface Message {
  id: string;
  prospect_id: string;
  direction: 'out' | 'in';
  subject: string | null;
  body: string;
  status: string;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft waiting',  color: '#92400e' },
  ready:     { label: 'Ready',          color: '#92400e' },
  sent:      { label: 'Sent',           color: '#1d4ed8' },
  replied:   { label: 'Replied',        color: '#5b21b6' },
  link_live: { label: 'Link live',      color: '#065f46' },
  declined:  { label: 'Declined',       color: '#6b7280' },
  dead:      { label: 'No response',    color: '#6b7280' },
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ });

export default async function OutreachPage({
  searchParams,
}: { searchParams: Promise<{ prospect?: string; ok?: string; error?: string }> }) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !can(session, 'outreach'))) {
    return <NoAccess section="Outreach" />;
  }
  const { prospect: selectedId, ok: okMsg, error: errMsg } = await searchParams;

  const admin = supabaseAdmin();
  const [{ data: prospectData }, { data: messageData }] = await Promise.all([
    admin.from('outreach_prospects')
      .select('id, domain, name, type, score, band, angle, asset, evidence, contact_email, contact_form_url, whatsapp, instagram, status, link_url, notes')
      .order('score', { ascending: false, nullsFirst: false }),
    admin.from('outreach_messages')
      .select('id, prospect_id, direction, subject, body, status, sent_by, sent_at, created_at')
      .order('created_at', { ascending: true }),
  ]);
  const prospects = (prospectData ?? []) as Prospect[];
  const messages = (messageData ?? []) as Message[];
  const byProspect = new Map<string, Message[]>();
  for (const m of messages) {
    const arr = byProspect.get(m.prospect_id) ?? [];
    arr.push(m);
    byProspect.set(m.prospect_id, arr);
  }

  const count = (s: string) => prospects.filter(p => p.status === s).length;
  const selected = selectedId ? prospects.find(p => p.id === selectedId) ?? null : null;
  const thread = selected ? (byProspect.get(selected.id) ?? []) : [];
  const hasBeenSent = thread.some(m => m.direction === 'out' && m.status === 'sent');

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Outreach</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 720 }}>
        Backlink and press pitches, sent from <b>hello@yellowpink.pk</b>. Edit any draft, send it when you are happy,
        and answer replies right here — nothing touches a personal inbox.
      </p>

      {errMsg && (
        <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>{errMsg}</div>
      )}
      {okMsg && (
        <div role="status" style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>{okMsg}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }} className="adm-stat-grid">
        <KpiCard label="Drafts waiting" value={count('draft') + count('ready')} accent="#d97706" />
        <KpiCard label="Sent" value={count('sent')} accent="#1d4ed8" />
        <KpiCard label="Replied" value={count('replied')} accent="#7c3aed" />
        <KpiCard label="Links live" value={count('link_live')} accent="#16a34a" />
      </div>

      {/* ─── Thread panel ────────────────────────────────────────────────── */}
      {selected && (
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                {selected.name || selected.domain}
                <a href={`https://${selected.domain}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 10, fontSize: '0.75rem', fontWeight: 500, color: '#C5286A', textDecoration: 'none' }}>
                  {selected.domain} ↗
                </a>
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280', maxWidth: 640 }}>
                {selected.angle}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DotChip label={STATUS_META[selected.status]?.label ?? selected.status} color={STATUS_META[selected.status]?.color ?? '#6b7280'} />
              <Link href="/admin/outreach" style={{ fontSize: '0.75rem', color: '#6b7280', textDecoration: 'none' }}>Close ✕</Link>
            </div>
          </div>

          {/* Contact line, editable: research finds most addresses but not all,
              and a wrong address is fixed here rather than in the database. */}
          <form action={updateProspect} style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', background: '#fafafa' }}>
            <input type="hidden" name="prospect_id" value={selected.id} />
            <div style={{ flex: '1 1 240px' }}>
              <label htmlFor="contact_email" style={lbl}>Contact email</label>
              <input id="contact_email" name="contact_email" type="email" defaultValue={selected.contact_email ?? ''} placeholder={selected.contact_form_url ? 'None published, they use a contact form' : 'editor@example.com'} style={inp} />
            </div>
            <div style={{ flex: '2 1 300px' }}>
              <label htmlFor="notes" style={lbl}>Notes</label>
              <input id="notes" name="notes" type="text" defaultValue={selected.notes ?? ''} maxLength={2000} style={inp} />
            </div>
            <button type="submit" style={btnGhost}>Save</button>
            {selected.contact_form_url && (
              <a href={selected.contact_form_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#C5286A', alignSelf: 'center' }}>Their contact form ↗</a>
            )}
          </form>

          {/* The conversation, oldest first. */}
          <div style={{ padding: '4px 16px 16px' }}>
            {thread.length === 0 && (
              <p style={{ padding: '20px 0', color: '#9ca3af', fontSize: '0.875rem' }}>No messages yet for this prospect.</p>
            )}
            {thread.map(m => (
              <div key={m.id} style={{ marginTop: 12, border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden', background: m.direction === 'in' ? '#f5f3ff' : 'white' }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: '0.75rem', color: '#6b7280' }}>
                  <span style={{ fontWeight: 600, color: m.direction === 'in' ? '#5b21b6' : '#111827' }}>
                    {m.direction === 'in' ? `From ${selected.domain}` : m.status === 'draft' ? 'Your pitch (draft, not sent)' : `Sent from hello@yellowpink.pk${m.sent_by ? ` by ${m.sent_by}` : ''}`}
                  </span>
                  <span>{m.sent_at ? fmtDate(m.sent_at) : fmtDate(m.created_at)}</span>
                </div>
                {m.direction === 'out' && m.status === 'draft' ? (
                  /* Draft: fully editable, one Send button. */
                  <form action={saveDraft} style={{ padding: 14, display: 'grid', gap: 10 }}>
                    <input type="hidden" name="message_id" value={m.id} />
                    <input type="hidden" name="prospect_id" value={selected.id} />
                    <div>
                      <label htmlFor={`subject-${m.id}`} style={lbl}>Subject</label>
                      <input id={`subject-${m.id}`} name="subject" type="text" defaultValue={m.subject ?? ''} maxLength={200} style={inp} />
                    </div>
                    <div>
                      <label htmlFor={`body-${m.id}`} style={lbl}>Message</label>
                      <textarea id={`body-${m.id}`} name="body" defaultValue={m.body} rows={12} maxLength={8000} style={{ ...inp, fontFamily: 'inherit', lineHeight: 1.55, resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" style={btnGhost}>Save changes</button>
                      <button type="submit" formAction={approveAndSend} style={btn} disabled={!selected.contact_email}>
                        {selected.contact_email ? `Send to ${selected.contact_email}` : 'Add a contact email first'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ padding: 14 }}>
                    {m.subject && <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 700, color: '#111827' }}>{m.subject}</p>}
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8125rem', lineHeight: 1.6, color: '#374151' }}>{m.body}</div>
                  </div>
                )}
              </div>
            ))}

            {/* Reply box appears once a conversation exists. */}
            {hasBeenSent && selected.contact_email && (
              <form action={sendReply} style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                <input type="hidden" name="prospect_id" value={selected.id} />
                <label htmlFor="reply-body" style={lbl}>Reply</label>
                <textarea id="reply-body" name="body" rows={5} maxLength={8000} placeholder="Write your reply. It sends from hello@yellowpink.pk as soon as you press the button." style={{ ...inp, fontFamily: 'inherit', lineHeight: 1.55, resize: 'vertical' }} />
                <div><button type="submit" style={btn}>Send reply</button></div>
              </form>
            )}

            {/* Outcome bookkeeping. */}
            <form action={markStatus} style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
              <input type="hidden" name="prospect_id" value={selected.id} />
              <div>
                <label htmlFor="status" style={lbl}>Outcome</label>
                <select id="status" name="status" defaultValue={selected.status === 'link_live' ? 'link_live' : ''} style={inp}>
                  <option value="" disabled>Set an outcome…</option>
                  <option value="link_live">Link is live</option>
                  <option value="declined">They declined</option>
                  <option value="dead">No response, closing</option>
                </select>
              </div>
              <div style={{ flex: '1 1 260px' }}>
                <label htmlFor="link_url" style={lbl}>Linking page URL (for “Link is live”)</label>
                <input id="link_url" name="link_url" type="url" defaultValue={selected.link_url ?? ''} placeholder="https://…" style={inp} />
              </div>
              <button type="submit" style={btnGhost}>Save outcome</button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Prospect list ───────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            Prospects ({prospects.length})
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
            Sorted by score. Open one to read, edit and send its pitch.
          </p>
        </div>
        {prospects.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No prospects yet. The campaign seeding adds them here.
          </div>
        ) : (
          <table className="adm-table-cards adm-cards-dense" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Prospect', 'Score', 'Type', 'Contact', 'Status', ''].map(h => (
                  <th scope="col" key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prospects.map(p => {
                const meta = STATUS_META[p.status] ?? { label: p.status, color: '#6b7280' };
                const draftCount = (byProspect.get(p.id) ?? []).filter(m => m.direction === 'out' && m.status === 'draft').length;
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6', background: p.id === selectedId ? '#fdf2f8' : undefined }}>
                    <td data-label="Prospect" style={td}>
                      <Link href={`/admin/outreach?prospect=${p.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                        {p.name || p.domain}
                      </Link>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{p.domain}</div>
                    </td>
                    <td data-label="Score" style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{p.score ?? '—'}</td>
                    <td data-label="Type" style={{ ...td, color: '#6b7280' }}>{p.type}</td>
                    <td data-label="Contact" style={{ ...td, fontSize: '0.75rem', color: p.contact_email ? '#374151' : '#9ca3af' }}>
                      {p.contact_email ?? (p.contact_form_url ? 'contact form' : 'none found')}
                    </td>
                    <td data-label="Status" style={td}>
                      <DotChip label={meta.label} color={meta.color} />
                      {draftCount > 0 && p.status !== 'draft' && (
                        <span style={{ marginLeft: 6, fontSize: '0.6875rem', color: '#92400e' }}>{draftCount} draft</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Link href={`/admin/outreach?prospect=${p.id}`} style={{ color: '#C5286A', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#374151', marginBottom: 3 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', background: 'white' };
const btn: React.CSSProperties = { padding: '8px 16px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' };
const th: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' };
const td: React.CSSProperties = { padding: '10px 16px', verticalAlign: 'top' };
