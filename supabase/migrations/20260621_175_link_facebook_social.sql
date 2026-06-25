-- Link the official Facebook page (owner-supplied). Shows in the footer social
-- icon row + Organization JSON-LD sameAs alongside Instagram and TikTok.
insert into site_settings (key, value)
values ('social_facebook', 'https://www.facebook.com/profile.php?id=61572832941994')
on conflict (key) do update set value = excluded.value;
