-- Outreach desk: backlink/press outreach run entirely from the admin.
--
-- Pitches are drafted (by the campaign tooling or by staff), sit editable
-- until a human approves them, and go out from hello@yellowpink.pk on one
-- click. Replies come back through the existing inbound-email webhook
-- (hello@ has no mailbox; Resend receives for the domain) and are threaded
-- onto the prospect by sender address, so the whole conversation lives in
-- Admin → Outreach and no personal inbox is involved.
--
-- Service-role access only, like the other admin-only tables: RLS enabled
-- with no policies, so the anon key can neither read prospects nor the
-- outreach correspondence.

create table if not exists outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  name text,
  -- blog | news | directory | brand | influencer | other
  type text not null default 'other',
  score numeric,
  band text,
  angle text,
  asset text,
  evidence text,
  contact_email text,
  contact_form_url text,
  whatsapp text,
  instagram text,
  status text not null default 'draft'
    check (status in ('draft','ready','sent','replied','link_live','declined','dead')),
  -- Filled in when the prospect actually links us: the page carrying the link.
  link_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists outreach_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references outreach_prospects(id) on delete cascade,
  direction text not null check (direction in ('out','in')),
  subject text,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft','sent','received')),
  -- Resend id for sent mail; lets the email log and this table be joined.
  resend_id text,
  -- Who pressed Send (staff email), for the audit trail.
  sent_by text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists outreach_messages_prospect_idx
  on outreach_messages (prospect_id, created_at);
create index if not exists outreach_prospects_status_idx
  on outreach_prospects (status);

alter table outreach_prospects enable row level security;
alter table outreach_messages  enable row level security;
