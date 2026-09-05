-- orders.pay_method accepted only 'cod', 'card' and 'bank'.
--
-- The application has offered more than that for a long time: PayMethod in
-- the TypeScript types, the checkout radio list and the place_order argument
-- all carry 'jazzcash', 'easypaisa' and 'gift_card' as well. Those three have
-- never reached the constraint in production only because checkout hides a
-- gateway method until its credentials exist (jazzcashConfigured /
-- easypaisaConfigured), and no credentials are set. The day someone pastes a
-- JazzCash merchant ID into the environment, every wallet checkout would fail
-- on a check violation at the final insert, after the shopper has filled the
-- whole form.
--
-- 'jazzcash_qr' is the new scan-to-pay method: the shopper scans the shop's
-- Raast code and pays from any bank or wallet app. It settles into the same
-- JazzCash Business account with no gateway integration.
--
-- place_order already derives the right status for it without a change:
--   case when v_payment in ('cod','gift_card') then 'pending'
--        else 'payment_pending' end
-- so a QR order waits in payment_pending until staff confirm the receipt,
-- exactly like a bank transfer.

alter table public.orders drop constraint if exists orders_pay_method_check;

alter table public.orders add constraint orders_pay_method_check
  check (pay_method = any (array[
    'cod'::text,
    'card'::text,
    'bank'::text,
    'jazzcash'::text,
    'jazzcash_qr'::text,
    'easypaisa'::text,
    'gift_card'::text
  ]));

-- The payments ledger records who took the money. A QR payment is confirmed by
-- staff against a receipt rather than by a gateway callback, but it is its own
-- channel and the finance views group by gateway, so give it a value instead of
-- letting it be filed under 'manual' with unrelated adjustments.
alter table public.payments drop constraint if exists payments_gateway_check;

alter table public.payments add constraint payments_gateway_check
  check (gateway = any (array[
    'jazzcash'::text,
    'jazzcash_qr'::text,
    'easypaisa'::text,
    'cod'::text,
    'bank'::text,
    'manual'::text,
    'gift_card'::text,
    'loyalty_points'::text
  ]));
