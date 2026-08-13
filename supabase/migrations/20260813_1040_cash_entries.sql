-- The cashbook: real cash movements, kept apart from P&L.
--
-- Finance answers "did we make money"; this table answers "how much money is
-- actually in hand". The owner buys stock in bulk from pocket, pays fees in
-- lumps, receives COD remittances on the courier's schedule and injects
-- capital — none of which is profit or expense at the moment it happens, but
-- all of it is cash. Every row is one movement: money in or money out.
--
-- Category is constrained to the fixed list in src/lib/cash.ts so the
-- monthly summary can group meaningfully; both lists must change together.

create table if not exists cash_entries (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in','out')),
  amount numeric not null check (amount > 0),
  category text not null check (category in (
    'stock_purchase','courier_fees','packaging','fees','vendor_payout',
    'marketing','owner_draw','other_out',
    'cod_remittance','online_payment','vendor_receipt','capital_in',
    'refund_received','other_in'
  )),
  note text,
  -- The day the money actually moved, which is often not the day it was
  -- recorded (bulk catch-up entry sessions are the expected usage).
  entry_date date not null default current_date,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists cash_entries_date_idx on cash_entries (entry_date desc, created_at desc);

alter table cash_entries enable row level security;
