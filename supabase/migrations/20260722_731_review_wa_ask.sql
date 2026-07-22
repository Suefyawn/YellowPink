-- Review asks queue (admin → Customers → Review asks): record the manual
-- WhatsApp review nudge on the order so staff never double-ask. The
-- automated review-request EMAIL keeps its own stamp
-- (review_request_sent_at); the two channels are tracked independently.

alter table public.orders add column if not exists review_wa_sent_at timestamptz;
alter table public.orders add column if not exists review_wa_sent_by text;
