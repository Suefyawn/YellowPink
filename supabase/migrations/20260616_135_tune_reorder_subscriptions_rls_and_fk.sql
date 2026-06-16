-- Audit fix (performance):
--  1. Wrap auth.uid() in a scalar sub-select so it is evaluated once per query
--     instead of once per row (auth_rls_initplan advisor).
--  2. Add a covering index for the unindexed FK reorder_subscriptions.variant_id.
alter policy reorder_subs_select_own on public.reorder_subscriptions
  using ((select auth.uid()) = user_id);
alter policy reorder_subs_insert_own on public.reorder_subscriptions
  with check ((select auth.uid()) = user_id);
alter policy reorder_subs_update_own on public.reorder_subscriptions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy reorder_subs_delete_own on public.reorder_subscriptions
  using ((select auth.uid()) = user_id);

create index if not exists reorder_subscriptions_variant_id_idx
  on public.reorder_subscriptions(variant_id);
