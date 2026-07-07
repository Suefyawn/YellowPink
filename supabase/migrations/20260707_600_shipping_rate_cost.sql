-- Per-zone delivery cost, so shipping margin can be tracked per region and the
-- admin can be warned when a zone's customer rate is set below what the courier
-- actually bills (the "stop small losses" guard). Nullable — falls back to the
-- global default_delivery_cost setting when unset.
alter table shipping_rates
  add column if not exists cost numeric;

comment on column shipping_rates.cost is
  'What the courier bills to deliver to this zone (PKR, incl. fuel + GST estimate). Used for the shipping-margin readout; null falls back to settings.default_delivery_cost.';
