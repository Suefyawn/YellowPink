-- Point cart recovery at the coupon that exists.
--
-- Both recovery channels ended their message with "Use code COMEBACK10 for a
-- discount if you order today", from a hardcoded default in two separate
-- files (the admin WhatsApp queue and the tier-3 reminder email). No coupon
-- called COMEBACK10 has ever existed in this table.
--
-- The coupon created for this job, on 14 July 2026, is COMEBACK15: 15% off
-- over PKR 1,500. Two months later its used_count was still 0, because nobody
-- has ever been told about it.
--
-- So every shopper who followed a recovery message typed a code that was
-- rejected at checkout, on the one screen where they had already hesitated
-- once. Over the 30 days to 15 September that is four phone-only carts worth
-- PKR 24,049, every one messaged by staff, none recovered.
--
-- Storing the code here rather than leaving it to a code default means staff
-- can change it in Admin -> Customers -> Abandoned without a deploy, and the
-- page now verifies whatever is set against this table before promising it.
insert into public.site_settings (key, value)
values ('abandoned_wa_coupon', 'COMEBACK15')
on conflict (key) do update set value = excluded.value;

-- AZADI14 expired on 15 August but is still flagged active, so it reads as a
-- live coupon in the admin list and would have been promised by the checker
-- above on its `active` flag alone. The checker also tests expires_at, so this
-- is belt and braces rather than the fix, but an expired coupon left switched
-- on is exactly how the next stale code gets promised.
update public.coupons
set active = false
where upper(code) = 'AZADI14'
  and expires_at is not null
  and expires_at < now()
  and active = true;
