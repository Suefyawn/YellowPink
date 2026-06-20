-- Internal staff notes on an order. The order timeline (order_events.note)
-- captures status-change reasons, but staff had nowhere to jot a freeform
-- internal note (e.g. "customer asked to deliver after 5pm", "called twice,
-- no answer"). This column backs an editable notes box on the order page.
-- Nullable, additive; never shown to the customer.
alter table public.orders
  add column if not exists notes text;

comment on column public.orders.notes is
  'Freeform internal staff note for this order (admin-only, never shown to the '
  'customer). Distinct from order_events.note, which records status-change reasons.';
