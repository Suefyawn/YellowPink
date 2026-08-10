-- COD refusal flags (owner decision, 10 Aug 2026): an identity that refused
-- a CONFIRMED COD delivery must prepay future orders — COD is withdrawn.
-- The flag keys on the normalized phone AND the lowercased email (owner:
-- "dont just use phone, use email too" — a refuser can swap SIMs but tends
-- to keep the email). Street addresses are deliberately not a key: they're
-- spelled ten different ways and exact matching would miss every variant.
--
-- Lifecycle: auto-set when a confirmed COD order transitions to 'returned'
-- (application code), auto-cleared when a later order matching either key
-- is delivered (they redeemed), staff can set/clear from the order page.
-- Enforcement is DISPATCH-SIDE ONLY (owner: "no resistance on order placing,
-- nothing that can hurt sales"): checkout is untouched, every order goes
-- through; a new order from a flagged identity rings the admin bell and the
-- order page tells staff to collect advance payment before dispatching.

create or replace function public.normalize_pk_phone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    -- digits only, then: 0092… / 92… → 0…, bare 3xxxxxxxxx → 03xxxxxxxxx
    when d like '0092%' then '0' || substr(d, 5)
    when d like '92%' and length(d) >= 12 then '0' || substr(d, 3)
    when d like '3%' and length(d) = 10 then '0' || d
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) t
$$;

create table if not exists public.cod_flags (
  id uuid primary key default gen_random_uuid(),
  phone text,
  email text,
  reason text,
  order_id uuid references public.orders(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by text,
  constraint cod_flags_has_identity check (phone is not null or email is not null)
);

-- One ACTIVE flag per identity key; cleared rows stay as the audit trail.
create unique index if not exists cod_flags_active_phone
  on public.cod_flags (phone) where cleared_at is null and phone is not null;
create unique index if not exists cod_flags_active_email
  on public.cod_flags (email) where cleared_at is null and email is not null;

alter table public.cod_flags enable row level security;
-- No public policies on purpose: reads and writes go through the service
-- role (checkout eligibility API, admin actions, status-transition hooks).

comment on table public.cod_flags is
  'Identities (normalized phone / lowercased email) that refused a confirmed COD delivery: advance payment required before dispatch. Active = cleared_at is null. Dispatch-side enforcement only — checkout is never gated.';
