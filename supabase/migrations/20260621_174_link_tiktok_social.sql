-- Link the official TikTok (@yellowpink848, owner-supplied). Shows in the
-- footer social row + Organization JSON-LD sameAs alongside Instagram.
insert into site_settings (key, value)
values ('social_tiktok', 'https://www.tiktok.com/@yellowpink848')
on conflict (key) do update set value = excluded.value;
