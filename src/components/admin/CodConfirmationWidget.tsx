import Link from 'next/link';

// Cash-on-delivery confirmation, measured.
//
// Roughly a third of COD orders get cancelled, and the one-click confirm link
// in the order email (shipped 14 Sep 2026) is the lever chosen against it —
// advance payment and deposits are ruled out by owner directive, because a
// checkout that asks for money up front loses the order rather than securing
// it. So this card is the only scoreboard that lever has.
//
// It reports THREE things, in the order they can actually be trusted:
//
//   1. The cancellation rate. One number, no interpretation needed.
//   2. The link's own uptake, counted only over orders placed since the link
//      went live. Mixing in older orders would permanently dilute it.
//   3. The confirmed-vs-unconfirmed cancellation split, WITH the caveat that
//      it is partly definitional (see below). It is the weakest of the three
//      and is presented last for that reason.

export interface CodConfirmationRow {
  cod_orders: number;
  confirmed: number;
  confirmed_by_link: number;
  confirmed_by_staff: number;
  cancelled: number;
  cancelled_confirmed: number;
  cancelled_unconfirmed: number;
  link_era_orders: number;
  link_era_confirmed: number;
  link_era_confirmed_by_link: number;
}

const card: React.CSSProperties = { background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' };

function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

export function CodConfirmationWidget({ row, days }: { row: CodConfirmationRow | null; days: number }) {
  if (!row || row.cod_orders === 0) {
    return (
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', marginBottom: 6 }}>Cash on delivery confirmation</div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>No cash-on-delivery orders in the last {days} days.</p>
      </div>
    );
  }

  const unconfirmed = row.cod_orders - row.confirmed;
  const cancelRate = row.cancelled / row.cod_orders;

  return (
    <div style={card}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem' }}>Cash on delivery confirmation</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          {row.cod_orders} COD orders in the last {days} days · the confirm link is the lever against cancellations
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, padding: '14px 18px' }}>
        <Stat
          label="Cancelled"
          value={pct(row.cancelled, row.cod_orders)}
          sub={`${row.cancelled} of ${row.cod_orders} orders`}
          tone={cancelRate > 0.2 ? 'warn' : 'plain'}
        />
        <Stat label="Confirmed before dispatch" value={pct(row.confirmed, row.cod_orders)} sub={`${row.confirmed} confirmed, ${unconfirmed} never were`} />
        <Stat
          label="Confirmed by the link"
          value={row.link_era_orders ? pct(row.link_era_confirmed_by_link, row.link_era_orders) : '—'}
          sub={row.link_era_orders
            ? `${row.link_era_confirmed_by_link} of ${row.link_era_orders} orders since it shipped`
            : 'no orders since it shipped'}
        />
        <Stat label="Confirmed by staff" value={String(row.confirmed_by_staff)} sub="WhatsApp or phone, recorded by hand" />
      </div>

      {/* The headline this card exists to move. */}
      <div style={{ margin: '0 18px 14px', padding: '10px 12px', background: '#faf6ee', borderRadius: 8, fontSize: '0.8125rem', color: '#374151', lineHeight: 1.55 }}>
        {row.link_era_orders === 0 ? (
          <>
            <strong>Nothing to read yet.</strong> No cash-on-delivery order has been placed since the confirm link
            went into the order email, so it has had no chance to be pressed. The first COD order is what starts
            this measurement. Until then the figures above describe the era before it.
          </>
        ) : (
          <>
            <strong>{row.link_era_confirmed_by_link} of {row.link_era_orders}</strong> orders since the link shipped were
            confirmed by the customer pressing it, with no staff time spent. That is the number this lever is meant
            to move: every one is a confirmation that previously needed someone to chase a reply.
          </>
        )}
      </div>

      <div style={{ padding: '0 18px 4px', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', fontWeight: 600 }}>
        Cancellation by confirmation
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '8px 18px 14px' }}>
        <Stat label="Confirmed orders" value={pct(row.cancelled_confirmed, row.confirmed)} sub={`${row.cancelled_confirmed} of ${row.confirmed} cancelled`} />
        <Stat label="Unconfirmed orders" value={pct(row.cancelled_unconfirmed, unconfirmed)} sub={`${row.cancelled_unconfirmed} of ${unconfirmed} cancelled`} tone="warn" />
      </div>

      {/* Stated on the card, not in a doc nobody opens: this split reads as a
          much stronger result than it is, and acting on it as proof would be
          a mistake. */}
      <div style={{ margin: '0 18px 16px', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
        <strong style={{ color: '#374151' }}>Read that split carefully.</strong> It is partly circular: staff cancel an
        order when they cannot reach the customer, and an order nobody could reach is also an order nobody confirmed.
        So it is not proof that confirming prevents cancellation. The figure that would be proof is the link&rsquo;s own
        uptake rising while the overall cancellation rate falls — the first two numbers on this card, watched together
        over the next few dozen orders.{' '}
        <Link href="/admin/orders?confirmed=no" style={{ color: '#C5286A', fontWeight: 600 }}>See unconfirmed orders</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = 'plain' }: { label: string; value: string; sub?: string; tone?: 'plain' | 'warn' }) {
  return (
    <div style={{ padding: '10px 12px', background: '#faf6ee', borderRadius: 8 }}>
      <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: tone === 'warn' ? '#b45309' : '#111827', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub ? <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{sub}</div> : null}
    </div>
  );
}
