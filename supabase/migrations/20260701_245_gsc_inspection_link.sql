-- The admin Indexing page's "Inspect in GSC" link was constructed by hand
-- (resource_id + id=<page URL>) and 404s in Search Console: the `id` param
-- Google's UI expects is an opaque per-inspection token it mints itself, not
-- the page URL. The urlInspection.index:inspect API already returns a ready
-- made deep link (`inspectionResult.inspectionResultLink`) with the correct
-- token, so store that instead of trying to reconstruct it.

alter table public.gsc_url_index_status
  add column if not exists inspection_link text;

comment on column public.gsc_url_index_status.inspection_link is
  'Ready-made Search Console deep link from the API response (inspectionResultLink). '
  'Do not construct this URL by hand, the id parameter is an opaque token, not the page URL.';
