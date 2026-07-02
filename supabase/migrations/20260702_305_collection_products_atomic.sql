-- ============================================================================
-- Atomic replace of a manual collection's product set.
--
-- setCollectionProducts previously ran a DELETE of every collection_products
-- row followed by a separate INSERT of the new ordered set, with no
-- transaction between them. A failed INSERT (a since-deleted product id, a
-- transient error) left the DELETE committed — emptying the LIVE collection
-- while the admin only saw an error toast. The order shoppers saw vanished.
--
-- This SECURITY DEFINER function performs the delete + insert inside a single
-- function body (one implicit transaction), so either the whole new set lands
-- or the old set is left untouched.
-- ============================================================================

create or replace function public.set_collection_products(
  p_collection_id uuid,
  p_product_ids   uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.collection_products
   where collection_id = p_collection_id;

  if array_length(p_product_ids, 1) is not null then
    insert into public.collection_products (collection_id, product_id, position)
    select p_collection_id, pid, ord - 1
      from unnest(p_product_ids) with ordinality as t(pid, ord);
  end if;
end;
$$;

comment on function public.set_collection_products(uuid, uuid[]) is
  'Atomically replaces a manual collection''s ordered product set (delete + '
  'insert in one transaction) so a failed insert cannot empty the live set.';

-- Admin mutations run through the service role, which bypasses RLS; keep the
-- function callable only by the service/owner roles (never anon).
revoke all on function public.set_collection_products(uuid, uuid[]) from public, anon, authenticated;
