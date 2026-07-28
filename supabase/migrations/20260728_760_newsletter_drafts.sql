-- Newsletter drafts: campaigns gain a status so an edition can be written and
-- reviewed before it is sent. Existing rows are all real sends, so the
-- default backfills them as 'sent'.
alter table newsletter_campaigns
  add column if not exists status text not null default 'sent'
  check (status in ('draft', 'sent'));
