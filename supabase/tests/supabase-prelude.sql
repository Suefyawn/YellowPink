-- ============================================================================
-- Supabase-compatibility prelude for vanilla Postgres 16.
--
-- The migrations in supabase/migrations assume the objects Supabase
-- provisions before any migration runs: the anon/authenticated/service_role
-- roles, the auth schema (auth.users + auth.uid()/role()/jwt()/email()), and
-- the storage schema. This file creates just enough of those for the full
-- migration chain to apply on a bare postgres:16 container — used by the CI
-- "migrations from scratch" job and runnable locally the same way:
--
--   createdb yp_ci
--   psql -d yp_ci -v ON_ERROR_STOP=1 -f supabase/tests/supabase-prelude.sql
--   for f in supabase/migrations/*.sql; do psql -d yp_ci -v ON_ERROR_STOP=1 -q -f "$f"; done
--   psql -d yp_ci -v ON_ERROR_STOP=1 -f supabase/tests/place_order_matrix.sql
--
-- It intentionally does NOT try to be a faithful Supabase replica (no
-- GoTrue, no storage API) — only what the SQL chain itself touches.
-- ============================================================================

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'localdev' noinherit;
  end if;
end $$;
grant anon to authenticator;
grant authenticated to authenticator;
grant service_role to authenticator;

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ── auth schema ──────────────────────────────────────────────────────────────
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  aud                text default 'authenticated',
  role               text default 'authenticated',
  email              text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  invited_at         timestamptz,
  confirmation_token text,
  recovery_token     text,
  raw_app_meta_data  jsonb default '{"provider":"email","providers":["email"]}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  phone              text,
  is_super_admin     boolean,
  last_sign_in_at    timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  deleted_at         timestamptz
);

-- Mirrors Supabase: resolved from the request JWT PostgREST injects.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb->>'sub','')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb->>'role',''),
    current_user::text)
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb->>'email','')
$$;

-- ── storage schema ───────────────────────────────────────────────────────────
create schema if not exists storage;

create table if not exists storage.buckets (
  id         text primary key,
  name       text not null,
  public     boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets(id),
  name             text,
  owner            uuid,
  metadata         jsonb default '{}'::jsonb,
  path_tokens      text[] generated always as (string_to_array(name, '/')) stored,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now()
);
alter table storage.objects enable row level security;

insert into storage.buckets (id, name, public)
values ('images','images',true)
on conflict (id) do nothing;

-- ── grants ───────────────────────────────────────────────────────────────────
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
