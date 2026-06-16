-- Audit fix (security): the public `images` bucket had a broad SELECT policy on
-- storage.objects (public_read_images) which let anonymous clients LIST every
-- file in the bucket. Public buckets serve objects via their public URL WITHOUT
-- needing a SELECT policy, so dropping it stops directory enumeration while
-- leaving public object downloads and service-role admin uploads fully working.
drop policy if exists public_read_images on storage.objects;
