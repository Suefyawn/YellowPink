-- ============================================================================
-- Contact messages — a storefront contact form that lands in an admin inbox.
--
-- hello@yellowpink.pk has no incoming mailbox, so the "email us" paths were
-- dead. This table backs a public contact form (on /page/contact) whose
-- submissions surface under Admin → Messages and are forwarded to the owner's
-- real address via Resend. Mirrors the product_reviews moderation pattern:
-- public INSERT (validated), staff read/manage via the service role, and a
-- DB trigger drops an admin_notifications row so the bell + sidebar light up.
-- ============================================================================

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  subject     text,
  message     text not null,
  -- new = unread, read = seen by staff, archived = filed away.
  status      text not null default 'new' check (status in ('new', 'read', 'archived')),
  source      text not null default 'contact_form',
  user_agent  text,
  ip_address  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.contact_messages is
  'Storefront contact-form submissions. Surfaced under Admin → Messages and '
  'forwarded to the owner via Resend. Public can INSERT (validated by RLS); '
  'only the service role reads them.';

create index if not exists contact_messages_status_created_idx
  on public.contact_messages (status, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Enable RLS and add ONLY an INSERT policy: with no SELECT policy, the anon /
-- authenticated roles can submit but never read other people's messages (they
-- contain PII). The admin reads via supabaseAdmin() (service role), which
-- bypasses RLS.
alter table public.contact_messages enable row level security;

drop policy if exists contact_messages_anon_insert on public.contact_messages;
create policy contact_messages_anon_insert on public.contact_messages
  for insert to anon, authenticated
  with check (
    name is not null    and char_length(btrim(name))    between 1 and 120
    and message is not null and char_length(btrim(message)) between 1 and 5000
    and email is not null
    and char_length(email) between 3 and 320
    and position('@' in email) > 1
    and position('.' in split_part(email, '@', 2)) > 0
    and coalesce(char_length(subject), 0) <= 200
    and source = 'contact_form'
  );

-- ── admin_notifications: allow the new 'new_message' kind ────────────────────
alter table public.admin_notifications drop constraint if exists admin_notifications_kind_check;
alter table public.admin_notifications add constraint admin_notifications_kind_check
  check (kind in (
    'new_order','low_stock','payment_failed','return_request','new_review','staff_added',
    'sentry_issue','posthog_spike','posthog_drop','new_message'
  ));

-- ── Notify staff on a new message (mirrors notify_new_review) ────────────────
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (kind, title, body, link, entity_id)
  values (
    'new_message',
    'New contact message',
    new.name || coalesce(' · ' || nullif(btrim(new.subject), ''), ''),
    '/admin/messages',
    new.id::text
  );
  return new;
end $$;

drop trigger if exists contact_messages_notify_new on public.contact_messages;
create trigger contact_messages_notify_new
  after insert on public.contact_messages
  for each row execute function public.notify_new_message();

-- Trigger function is security definer; keep it off the public API surface
-- (same hardening as the other notify_* functions).
revoke execute on function public.notify_new_message() from public, anon, authenticated;
