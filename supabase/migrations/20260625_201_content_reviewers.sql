-- ============================================================================
-- Medical Review Board — credentialed, specialty-matched reviewers for YMYL
-- health/wellness content (E-E-A-T phase 2).
--
-- Real, named clinicians who genuinely review the store's health articles.
-- A post is linked to one reviewer (blog_posts.reviewer_id); the article then
-- shows a "Medically reviewed by Dr. X, <credentials>" byline + Article.
-- reviewedBy schema, with sameAs pointing at the reviewer's verifiable profile.
-- The public /medical-review-board page lists the panel (authoritativeness),
-- and each reviewer gets a profile page (the sameAs target + Person schema).
--
-- Reviewers volunteer (no compensation), so there is no incentivised-review or
-- disclosure concern — kept entirely separate from the customer loyalty and
-- product-review systems.
-- ============================================================================

create table if not exists public.content_reviewers (
  id            uuid primary key default gen_random_uuid(),
  slug         text not null unique,                 -- /medical-review-board/<slug>
  name         text not null,                        -- "Dr. Ayesha Khan"
  credentials  text,                                 -- "MBBS, FCPS (Gynaecology)"
  specialty    text,                                 -- "Obstetrics & Gynaecology"
  bio          text,                                 -- short professional bio
  photo_url    text,
  profile_url  text,                                 -- PMDC reg / hospital / LinkedIn — used as schema sameAs
  review_topics text[] not null default '{}',        -- health category labels they're qualified to review (for matching)
  is_default   boolean not null default false,       -- fallback reviewer for health posts with no explicit assignment
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.content_reviewers enable row level security;
-- Public read of ACTIVE reviewers only (the anon-keyed storefront renders the
-- board + bylines). Writes happen through the service-role admin client.
drop policy if exists content_reviewers_read on public.content_reviewers;
create policy content_reviewers_read on public.content_reviewers for select using ( active = true );

-- At most one default reviewer.
create unique index if not exists content_reviewers_one_default
  on public.content_reviewers (is_default) where is_default;

-- Per-post assignment. on delete set null so removing a reviewer never orphans
-- a post — it just falls back to the default (or shows no review line).
alter table public.blog_posts
  add column if not exists reviewer_id uuid references public.content_reviewers(id) on delete set null;
