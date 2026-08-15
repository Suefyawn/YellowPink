-- Migration 1210 — dedicated cash category for customer refunds.
--
-- Refund suggestions from the order_refunds ledger were filed under
-- `other_out` because the original category list had no outbound
-- customer-refund bucket (`refund_received` is the inbound supplier-side
-- one). Give them their own category so the cash summary groups them.

alter table public.cash_entries drop constraint if exists cash_entries_category_check;
alter table public.cash_entries add constraint cash_entries_category_check
  check (category in (
    'stock_purchase','courier_fees','packaging','fees','vendor_payout',
    'marketing','owner_draw','customer_refund','other_out',
    'cod_remittance','online_payment','vendor_receipt','capital_in',
    'refund_received','other_in'
  ));
