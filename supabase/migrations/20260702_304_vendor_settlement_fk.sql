-- ============================================================================
-- Preserve vendor settlement (financial) history when a vendor is deleted.
--
-- Before this migration `vendor_settlements.vendor_id` referenced
-- `vendors(id)` with ON DELETE CASCADE, so deleting a vendor silently
-- destroyed every payout / margin row ever recorded for them — real financial
-- history the Payouts table and any reconciliation depend on. The FK-error
-- guard in deleteVendor could therefore never fire (products.vendor_id and
-- orders.vendor_id are both ON DELETE SET NULL, and settlements cascaded away),
-- so the delete always "succeeded" while quietly wiping the ledger.
--
-- Fix: keep the settlement rows. Switch the FK to ON DELETE SET NULL and add a
-- `vendor_name` snapshot so a settlement whose vendor has been deleted still
-- reads sensibly in the admin (it no longer joins back to a live vendor row).
-- ============================================================================

-- 1. Snapshot column for the vendor's display name at settlement time.
alter table public.vendor_settlements
  add column if not exists vendor_name text;

comment on column public.vendor_settlements.vendor_name is
  'Snapshot of the vendor name at settlement time. Kept so the payout row still '
  'reads sensibly after the vendor is deleted (vendor_id is then set null).';

-- 2. Backfill existing rows from the live vendor.
update public.vendor_settlements s
   set vendor_name = v.name
  from public.vendors v
 where v.id = s.vendor_id
   and s.vendor_name is null;

-- 3. vendor_id must be nullable for ON DELETE SET NULL to be legal.
alter table public.vendor_settlements
  alter column vendor_id drop not null;

-- 4. Swap the cascade FK for SET NULL so deleting a vendor detaches — never
--    deletes — their settlement history.
alter table public.vendor_settlements
  drop constraint if exists vendor_settlements_vendor_id_fkey;

alter table public.vendor_settlements
  add constraint vendor_settlements_vendor_id_fkey
    foreign key (vendor_id) references public.vendors(id) on delete set null;
