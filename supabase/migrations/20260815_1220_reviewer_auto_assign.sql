-- Migration 1220 — medical review assignment workflow.
--
-- Until now blog_posts.reviewer_id was a plain credit: setting it instantly
-- rendered "Medically reviewed by Dr. X" on the article. That conflates two
-- different facts — "this doctor is ASKED to review this post" and "this
-- doctor HAS reviewed this post". This migration separates them:
--
--   review_status: 'pending'  — assigned, awaiting the doctor's sign-off;
--                                the byline must NOT render.
--                  'approved' — the doctor reviewed it; byline renders.
--   reviewed_at:   stamped on approval.
--
-- Existing assignments are grandfathered as approved (they were arranged
-- reviews credited after the fact). New posts are auto-assigned as PENDING
-- by trigger: the active reviewer whose review_topics covers the post's
-- topic and who has the fewest open assignments gets it; health posts with
-- no qualified reviewer fall to the default reviewer; non-medical topics
-- (currently 'Makeup & beauty') get no reviewer at all.

alter table public.blog_posts
  add column if not exists review_status text
    check (review_status in ('pending','approved')),
  add column if not exists reviewed_at timestamptz;

-- Grandfather: everything already credited counts as approved.
update public.blog_posts
  set review_status = 'approved'
  where reviewer_id is not null and review_status is null;

create or replace function public.assign_reviewer_for_topic(p_topic text)
returns uuid
language sql
stable
as $$
  select id from public.content_reviewers
  where active
    and p_topic is not null
    and p_topic <> 'Makeup & beauty'
    and review_topics @> array[p_topic]
  order by (
    select count(*) from public.blog_posts b
    where b.reviewer_id = content_reviewers.id
      and b.review_status = 'pending'
  ) asc, sort_order asc
  limit 1
$$;

create or replace function public.blog_posts_auto_assign_reviewer()
returns trigger
language plpgsql
as $$
declare
  v_reviewer uuid;
begin
  -- Only when nothing is set by hand and the post is health content.
  if new.reviewer_id is not null or new.topic is null or new.topic = 'Makeup & beauty' then
    return new;
  end if;
  v_reviewer := public.assign_reviewer_for_topic(new.topic);
  if v_reviewer is null then
    select id into v_reviewer from public.content_reviewers where is_default and active;
  end if;
  if v_reviewer is not null then
    new.reviewer_id := v_reviewer;
    new.review_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists blog_posts_auto_assign on public.blog_posts;
create trigger blog_posts_auto_assign
  before insert on public.blog_posts
  for each row execute function public.blog_posts_auto_assign_reviewer();
