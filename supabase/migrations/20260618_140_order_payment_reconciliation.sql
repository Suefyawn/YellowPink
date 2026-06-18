-- Migration 140 — per-order payment reconciliation.
--
-- Bank-transfer / wallet orders are confirmed manually: the customer transfers
-- to one of the configured accounts (Settings → Payments) and sends a receipt,
-- then a staffer marks the payment received. We capture WHICH account the money
-- landed in, WHEN, and WHO confirmed it, so Finance can break revenue down by
-- account and surface orders still awaiting confirmation.
--
-- Additive + nullable: existing orders are simply "unreconciled" until a staffer
-- records a payment. No backfill, no behaviour change for existing flows.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_account     TEXT,
  ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_received_by TEXT;

COMMENT ON COLUMN public.orders.payment_account IS
  'Label of the configured bank/wallet account the payment landed in (or "Cash on delivery"). Set by staff during reconciliation; null = not yet recorded.';
COMMENT ON COLUMN public.orders.payment_received_at IS
  'When staff marked the payment received. Null until reconciled.';
COMMENT ON COLUMN public.orders.payment_received_by IS
  'Email/name of the staffer (or "Owner") who recorded the payment.';

-- Speeds up the Finance "awaiting confirmation" lookup (orders with no recorded
-- payment) without scanning the whole table.
CREATE INDEX IF NOT EXISTS orders_payment_received_at_idx
  ON public.orders (payment_received_at);
