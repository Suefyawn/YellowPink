-- Optional short product video shown as a (non-autoplay) slide in the PDP
-- gallery carousel. Stored as a public URL (Supabase storage / CDN); null
-- means image-only, the default.
alter table public.products add column if not exists video_url text;
