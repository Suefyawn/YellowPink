'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrderContact } from '@/app/admin/actions';

// The order page's shipping-address card, made editable (Shopify: order →
// Edit shipping address / contact information). Read mode mirrors the old
// server-rendered <dl> exactly; Edit swaps it for a prefilled form covering
// the recipient fields. Saving calls updateOrderContact and refreshes the
// route so the server-rendered Customer card, invoice and WhatsApp messages
// pick up the new details immediately.

export interface OrderContact {
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  province: string | null;
  zip: string | null;
}

const dl: React.CSSProperties = { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px', margin: 0 };
const dt: React.CSSProperties = { fontSize: '0.8125rem', color: '#6b7280', fontWeight: 500 };
const dd: React.CSSProperties = { fontSize: '0.875rem', color: '#111827', margin: 0, minWidth: 0, overflowWrap: 'anywhere' };
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '0.875rem',
  border: '1px solid #d1d5db', borderRadius: 8, background: 'white', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4,
};

export function OrderContactEdit({ orderId, contact, canEdit }: {
  orderId: string;
  contact: OrderContact;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${contact.address}, ${contact.city}${contact.province ? `, ${contact.province}` : ''}${contact.zip ? ` ${contact.zip}` : ''}, Pakistan`
  )}`;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    startTransition(async () => {
      const res = await updateOrderContact(orderId, fd);
      if (res?.error) {
        setErr(res.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Shipping address</h2>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.75rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none' }}
          >
            Open in Maps ↗
          </a>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => { setErr(null); setEditing(true); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 600, color: '#C5286A',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {!editing ? (
        <dl style={dl}>
          <dt style={dt}>Address</dt>
          <dd style={dd}>{contact.address}</dd>
          <dt style={dt}>City</dt>
          <dd style={dd}>{contact.city}{contact.province ? `, ${contact.province}` : ''}</dd>
          {contact.zip && <><dt style={dt}>ZIP</dt><dd style={dd}>{contact.zip}</dd></>}
        </dl>
      ) : (
        <form onSubmit={submit}>
          {err && (
            <div role="alert" style={{
              background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
              borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.8125rem',
            }}>
              {err}
            </div>
          )}
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl} htmlFor="oc-first">First name</label>
              <input id="oc-first" name="first_name" defaultValue={contact.first_name} style={inp} />
            </div>
            <div>
              <label style={lbl} htmlFor="oc-last">Last name</label>
              <input id="oc-last" name="last_name" defaultValue={contact.last_name} style={inp} />
            </div>
            <div>
              <label style={lbl} htmlFor="oc-phone">Phone *</label>
              <input id="oc-phone" name="phone" required inputMode="tel" defaultValue={contact.phone} style={inp} />
            </div>
            <div>
              <label style={lbl} htmlFor="oc-email">Email (optional)</label>
              <input id="oc-email" name="email" type="email" defaultValue={contact.email ?? ''} style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl} htmlFor="oc-address">Address *</label>
              <input id="oc-address" name="address" required defaultValue={contact.address} style={inp} />
            </div>
            <div>
              <label style={lbl} htmlFor="oc-city">City *</label>
              <input id="oc-city" name="city" required defaultValue={contact.city} style={inp} />
            </div>
            <div>
              <label style={lbl} htmlFor="oc-province">Province</label>
              <input id="oc-province" name="province" defaultValue={contact.province ?? ''} style={inp} />
            </div>
            <div>
              <label style={lbl} htmlFor="oc-zip">ZIP (optional)</label>
              <input id="oc-zip" name="zip" defaultValue={contact.zip ?? ''} style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <button
              type="submit"
              disabled={pending}
              style={{
                padding: '8px 16px',
                background: pending ? '#9ca3af' : '#C5286A',
                color: 'white', border: 'none', borderRadius: 7,
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setErr(null); }}
              disabled={pending}
              style={{
                padding: '8px 14px', background: 'white', color: '#6b7280',
                border: '1px solid #d1d5db', borderRadius: 7,
                fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
            Updates the delivery details on this order only. The change is recorded in the Activity log.
          </p>
        </form>
      )}
    </>
  );
}
