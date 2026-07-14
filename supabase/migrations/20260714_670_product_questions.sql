-- ============================================================================
-- Product Q&A (SEO audit D1): customers ask a question on a product page,
-- staff answer + approve it in admin → Questions, and approved Q&As render on
-- the PDP as unique, crawlable long-tail content.
--
-- Moderation model mirrors product_reviews:
--   • public (anon/authenticated) INSERT is constrained to pending, unanswered
--     rows — the ask form; anyone hitting PostgREST directly with the anon key
--     cannot self-approve a question or plant an "answer".
--   • public SELECT sees approved rows only, so pending/rejected questions
--     never leak to the storefront.
--   • The admin moderation path (answer + approve / reject) runs with the
--     service role, which bypasses RLS entirely — no explicit policy needed.
-- ============================================================================

create table if not exists public.product_questions (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  author_name  text not null,
  question     text not null,
  -- Written by staff in admin → Questions; approval requires a non-empty
  -- answer (enforced in the server action), so a published Q&A is never a
  -- question hanging without a reply.
  answer       text,
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected')),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz
);

-- The PDP reads only approved rows per product, mirror product_reviews'
-- partial index shape.
create index if not exists product_questions_product_idx
  on public.product_questions (product_id) where status = 'approved';

alter table public.product_questions enable row level security;

drop policy if exists "public insert pending question" on public.product_questions;
create policy "public insert pending question" on public.product_questions
  for insert to public
  with check ( status = 'pending' and answer is null );

drop policy if exists "read approved questions" on public.product_questions;
create policy "read approved questions" on public.product_questions
  for select to public
  using ( status = 'approved' );
