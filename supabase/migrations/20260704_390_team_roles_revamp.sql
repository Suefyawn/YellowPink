-- Migration 390 — Team & access-roles revamp (2026-07 admin audit).
--
-- 1) Session control: session_epoch is stamped into the login cookie; bumping
--    it (password reset, deactivation) invalidates every outstanding session
--    immediately instead of waiting out the 10h cookie TTL.
--    must_change_password is set by owner resets / new accounts and steers
--    the next login to the change-password form. last_login_at feeds the Team
--    page's "Last sign-in" column.
-- 2) Two new permissions: 'vendors' (vendor directory + settlements, was
--    piggybacking on orders.*) and 'system_tools' (Email log / Broken links /
--    Indexing, was piggybacking on 'settings'). Backfill: anyone who could do
--    those things yesterday keeps the ability today.
-- 3) Built-in role seeds rewritten so descriptions match their actual grants
--    ('Customer support' silently held orders.delete + customers.delete and
--    lacked Messages). The never-assigned 'Analyst' seed is removed when no
--    member holds it.
-- 4) Drop the orphaned staff_grants table (superseded by roles +
--    staff_members.permissions before it ever shipped a reader).

alter table public.staff_members
  add column if not exists session_epoch        integer      not null default 0,
  add column if not exists must_change_password boolean      not null default false,
  add column if not exists last_login_at        timestamptz;

-- ── New-permission backfill ─────────────────────────────────────────────────
-- vendors: granted where orders.edit exists (vendor management was gated on
-- orders.edit; orders.view only exposed the read-only page).
update public.roles
  set permissions = array_append(permissions, 'vendors')
  where permissions @> array['orders.edit'] and not permissions @> array['vendors'];
update public.staff_members
  set permissions = array_append(permissions, 'vendors')
  where permissions @> array['orders.edit'] and not permissions @> array['vendors'];

-- system_tools: granted where settings exists (the three tool pages were
-- gated on 'settings').
update public.roles
  set permissions = array_append(permissions, 'system_tools')
  where permissions @> array['settings'] and not permissions @> array['system_tools'];
update public.staff_members
  set permissions = array_append(permissions, 'system_tools')
  where permissions @> array['settings'] and not permissions @> array['system_tools'];

-- ── Built-in role seeds: honest grants + descriptions ───────────────────────
update public.roles set
  permissions = array[
    'analytics','analytics_traffic','analytics_errors','analytics_refresh',
    'orders.view','orders.edit','orders.delete','returns','vendors',
    'products.view','products.edit','products.delete',
    'customers.view','customers.edit','customers.delete','messages','reviews',
    'coupons','blog','newsletter'
  ],
  description = 'Runs the store day-to-day: everything except Finance, Settings and System tools.',
  updated_at = now()
  where name = 'Manager' and is_system;

update public.roles set
  permissions = array['orders.view','orders.edit','customers.view','returns','messages'],
  description = 'Handles customer queries: view/manage orders, view customers, returns and messages. No deletes.',
  updated_at = now()
  where name = 'Customer support' and is_system;

update public.roles set
  permissions = array['products.view','products.edit'],
  description = 'Maintains the catalogue and stock: view and edit products. No deletes.',
  updated_at = now()
  where name = 'Inventory' and is_system;

update public.roles set
  permissions = array['blog','newsletter','coupons','reviews','analytics','analytics_traffic'],
  description = 'Content and campaigns: blog, newsletter, coupons, reviews, plus sales and traffic analytics.',
  updated_at = now()
  where name = 'Marketer' and is_system;

-- Remove the never-assigned Analyst seed (kept if anyone actually holds it).
delete from public.roles r
  where r.name = 'Analyst' and r.is_system
  and not exists (select 1 from public.staff_members s where s.role_id = r.id);

-- ── Orphaned table ──────────────────────────────────────────────────────────
drop table if exists public.staff_grants;
