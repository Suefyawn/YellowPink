-- Link the verified official Instagram profile (handle == the store domain,
-- "Yellow Pink Store — medical-grade skincare & cosmetics from international
-- brands"). Shows in the footer social row + Organization JSON-LD sameAs.
-- Facebook/TikTok/etc. left blank pending owner-confirmed handles (the only
-- "Yellow Pink" Facebook found was a Brazilian store — not this one).
insert into site_settings (key, value)
values ('social_instagram', 'https://www.instagram.com/yellowpink.pk/')
on conflict (key) do update set value = excluded.value;
