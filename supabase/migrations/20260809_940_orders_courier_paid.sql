-- TCS's Payment Detail ledger reports, per consignment, whether the courier
-- has remitted the COD cash and how much ("payment status" / "amount paid" /
-- "payment date"). Store that courier-side claim on the order so the COD
-- reconciliation tab can show "TCS says paid out" next to orders still
-- awaiting the owner's bank confirmation. Deliberately SEPARATE from
-- payment_received_at: that column is the owner's manual bank-statement
-- confirmation (the order-actions nudge system depends on it) — the courier
-- saying "remitted" and the owner seeing it in the bank are different facts.

alter table public.orders
  add column if not exists courier_paid_at timestamptz,
  add column if not exists courier_paid_amount numeric;
