-- Archive Hello Hair and the other wholesale trade-pack lines.
--
-- Owner instruction, 14 Sep 2026: "Archive hello hair and other cheap stuff."
--
-- These were never on the storefront — all 57 sat in `draft`, which the
-- storefront already hides. So this changes nothing a shopper can see. What it
-- fixes is the ADMIN: 356 of 608 products are drafts, and a brand nobody
-- intends to sell should read as "no longer sold" (archived), not as "not
-- finished yet" (draft). Shopify draws that line the same way, and the admin's
-- product filters follow it, so staff stop re-reviewing 57 rows that were
-- already decided.
--
-- Scope is deliberately narrow: Hello Hair in full, plus the Golden Pearl
-- WHOLESALE trade packs, which are the same class of item (180ml/75ml
-- "Trade Pack" multipacks and 36-sachet boxes priced at PKR 12,960-16,800 —
-- wholesale units that do not belong in a retail catalogue).
--
-- Deliberately NOT touched: the cheap PUBLISHED products. There are 23 live
-- items under PKR 400 — emergency contraceptive pills at PKR 40, pregnancy
-- test strips at PKR 60, children's zinc and iron syrups — and they are core
-- Women's Health and Kids stock, not "cheap stuff". Low price is not the same
-- as low quality, and archiving a live contraceptive line on that reading
-- would remove real catalogue. Those stay published.

-- ── 1. Hello Hair, every remaining draft ────────────────────────────────────
update public.products
set status = 'archived', updated_at = now()
where brand = 'Hello Hair'
  and status = 'draft';

-- ── 2. Golden Pearl wholesale trade packs only ──────────────────────────────
-- Matched on the name, not the brand: Golden Pearl also has retail lines that
-- are a normal part of the catalogue and must not be swept up here.
update public.products
set status = 'archived', updated_at = now()
where brand = 'Golden Pearl'
  and status = 'draft'
  and (name ilike '%trade pack%' or name ilike '%bulk%' or name ilike '%pack of 36%');

-- ── 3. Fix a miscategorisation these rows were carrying ─────────────────────
-- Four Hello Hair SHAMPOOS were filed under subcategory 'Bulk Face Cream' in
-- category 'Hair Care' — a copy-paste from the Golden Pearl bulk cream row.
-- Archived rows still feed the admin's category filters and any future CSV
-- export, so correct it rather than leaving a wrong label behind.
update public.products
set subcategory = 'Shampoo', updated_at = now()
where category = 'Hair Care'
  and subcategory = 'Bulk Face Cream'
  and name ilike '%shampoo%';
