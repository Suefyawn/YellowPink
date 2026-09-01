-- ============================================================================
-- Sale events: the occasions library. 2026-09-01.
--
-- Owner directive: every sale occasion of the year keeps a saved storefront
-- "version" (theme, hero copy, announcement bar, coupon) so each year the
-- sale is one click from Admin → Marketing → Sales & occasions, instead of
-- retyping the Branding card. Activation copies a row's fields into the
-- existing seasonal-theme settings keys — the storefront pipeline
-- (src/lib/seasonal-theme.ts) is unchanged.
--
-- Dates are THIS YEAR's window (inclusive, PKT) and are meant to be updated
-- each year — lunar-calendar occasions (Ramadan, both Eids, Ashura, Eid
-- Milad) shift ~11 days earlier every year, so their rows ship with NULL
-- dates whenever the 2026 occurrence has already passed.
-- ============================================================================

create table public.sale_events (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  name           text not null,
  theme          text not null,
  starts_on      date,
  ends_on        date,
  bar_message    text,
  bar_coupon     text,
  hero_overline  text,
  hero_headline  text,
  hero_subline   text,
  hero_cta1_text text,
  hero_cta1_url  text,
  hero_image_url text,
  notes          text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.sale_events is
  'Occasions library: saved storefront versions (theme + hero + bar + coupon) for each sale of the year. Activating one copies its fields into the seasonal-theme site_settings keys. Managed from Admin -> Sales & occasions; service-role only.';

-- Service-role only, same posture as site_settings management.
alter table public.sale_events enable row level security;
revoke all on public.sale_events from anon, authenticated;

-- ── Seed: the Pakistani retail calendar ─────────────────────────────────────
-- Copy follows the store's voice rules (plain, specific, no em-dashes).
-- Coupons are suggestions: activating an event does NOT create the coupon;
-- create/enable it in Admin -> Coupons (the note on each row says so).

insert into public.sale_events
  (key, name, theme, starts_on, ends_on, bar_message, bar_coupon, hero_overline, hero_headline, hero_subline, hero_cta1_text, hero_cta1_url, notes, sort_order)
values
-- ── Fixed-date national & international days ────────────────────────────────
('new-year', 'New Year Sale', 'sale', '2026-12-26', '2027-01-02',
 'New year, new skin: up to 20% off', 'NEWYEAR',
 'New Year Sale', 'Start the year with<br/>your best skin', 'Fresh-start prices on skincare, supplements and makeup, delivered anywhere in Pakistan.', 'Shop the sale', '/shop',
 'Runs 26 Dec to 2 Jan. Create/enable the NEWYEAR coupon in Coupons before activating.', 10),

('kashmir-day', 'Kashmir Day', 'independence', null, null,
 'Kashmir Solidarity Day: 5 Feb', null,
 '5 February', 'Standing with Kashmir', 'A day of solidarity. Nationwide delivery continues as usual.', 'Shop', '/shop',
 'Observance, not a discount push: green look, no coupon. Set dates to 3-5 Feb each year if you want it up for the long weekend.', 20),

('womens-day', 'Women''s Day', 'women', null, null,
 'Women''s Day: she deserves the best', 'HERDAY',
 '8 March', 'Made for her,<br/>made for you', 'Skincare, wellness and beauty picks for the women who hold everything together.', 'Shop the edit', '/shop',
 'Set dates to 6-8 Mar each year. Create the HERDAY coupon first. Strong gifting angle: pair with a curated collection.', 30),

('pakistan-day', 'Pakistan Day Sale', 'independence', null, null,
 'Pakistan Day Sale: up to 23% off', 'PAKDAY',
 '23 March', 'Pakistan Day Sale', 'Celebrate with up to 23% off across the store. Cash on delivery nationwide.', 'Shop the sale', '/shop',
 'Set dates to 21-23 Mar each year. The 23% number is the hook (23 March); adjust the real discount in Coupons.', 40),

('world-health-day', 'World Health Day', 'easter', null, null,
 'World Health Day: wellness picks inside', null,
 '7 April', 'Small habits,<br/>better health', 'Doctor-reviewed supplements and everyday wellness, picked for World Health Day.', 'Shop wellness', '/shop?category=health-weallness',
 'Content moment more than a sale: lead with the health catalogue and quick answers, coupon optional. Set dates to 5-7 Apr.', 50),

('mothers-day', 'Mother''s Day', 'women', null, null,
 'For Ammi, with love', 'FORAMMI',
 'Second Sunday of May', 'She never asks.<br/>Gift it anyway', 'Gentle skincare and wellness gifts for Ammi, wrapped and delivered across Pakistan.', 'Shop gifts', '/shop',
 'Second Sunday of May (10 May 2026, 9 May 2027). Set a 3-4 day window ending that Sunday.', 60),

('summer-sale', 'Summer Skin Sale', 'sale', null, null,
 'Summer Skin Sale: sunscreen from every big brand', 'SUMMER',
 'June heat, handled', 'Your summer<br/>skin survival kit', 'Sunscreens, gel moisturisers and sweat-proof makeup for Pakistani summers.', 'Shop sunscreen', '/category/sunscreen',
 'Flexible 2-week June window. Sunscreen is the hero category; feature SPF bundles.', 70),

('azadi', 'Azadi Sale', 'independence', null, null,
 'Azadi Sale: up to 25% off till 14 August', 'AZADI',
 '14 August', 'Azadi Sale', 'Freedom-week prices across skincare, makeup and wellness. Up to 25% off, COD nationwide.', 'Shop the sale', '/shop',
 'The proven big one: run 1-14 Aug. Hero model image from last year is in /catalog/azadi-hero-model.webp; upload it as the hero image if you want the same look.', 80),

('defence-day', 'Defence Day', 'independence', '2026-09-04', '2026-09-06',
 'Defence Day weekend: up to 15% off', 'DEFENCE',
 '6 September', 'Defence Day weekend', 'A salute to the defenders. Weekend prices across the store, COD nationwide.', 'Shop the sale', '/shop',
 'Runs 4-6 Sep 2026. Create the DEFENCE coupon before activating.', 90),

('teachers-day', 'Teachers'' Day', 'women', '2026-10-03', '2026-10-05',
 'Teachers'' Day: a gift for the one who taught you', 'SHUKRIYA',
 '5 October', 'Thank a teacher', 'Self-care gifts for the teachers who shaped you. Delivered anywhere in Pakistan.', 'Shop gifts', '/shop',
 'Runs 3-5 Oct 2026. Gifting angle; pair with an under-Rs-2500 gift collection.', 100),

('iqbal-day', 'Iqbal Day', 'independence', '2026-11-07', '2026-11-09',
 'Iqbal Day weekend: up to 15% off', 'IQBAL',
 '9 November', 'Khudi, and a little self-care', 'Iqbal Day weekend prices across skincare and wellness. COD nationwide.', 'Shop the sale', '/shop',
 'Runs 7-9 Nov 2026, then rolls straight into 11.11: schedule both and the windows hand over automatically.', 110),

('eleven-eleven', '11.11 Mega Sale', 'sale', '2026-11-09', '2026-11-11',
 '11.11 Mega Sale: the year''s biggest prices', 'ELEVEN',
 '11.11', 'The biggest sale<br/>of the year', 'Pakistan''s biggest online shopping day. Deepest discounts of the year, three days only.', 'Shop 11.11', '/shop',
 'THE online sale day in Pakistan (Daraz trained the market). Go deepest here: site-wide coupon plus slashed original_price on hero products. Overlaps Iqbal Day: 11.11 wins, schedule it to start 9 Nov 00:00.', 120),

('blessed-friday', 'Blessed Friday', 'blackfriday', '2026-11-23', '2026-11-27',
 'Blessed Friday: up to 40% off, one week only', 'BLESSED',
 'Blessed Friday', 'Blessed Friday.<br/>Our deepest prices', 'The global sale, the Pakistani way. Up to 40% off all week, cash on delivery nationwide.', 'Shop the deals', '/shop',
 'PK retailers say "Blessed Friday", not Black Friday: keep that wording. 23-27 Nov 2026 (fourth Friday of Nov). Second-deepest discounts after 11.11.', 130),

('twelve-twelve', '12.12 Year-End Sale', 'sale', '2026-12-10', '2026-12-12',
 '12.12 Sale: last big prices of the year', 'TWELVE',
 '12.12', 'One last<br/>mega sale', 'The year''s closing sale. Stock up on skincare and supplements before prices reset.', 'Shop 12.12', '/shop',
 'Runs 10-12 Dec 2026. Clears stock before year-end; good slot for bundle deals.', 140),

('quaid-day-winter', 'Quaid Day / Winter Sale', 'christmas', '2026-12-20', '2026-12-25',
 'Winter Sale: warm skin, cool prices', 'WINTER',
 '25 December', 'Winter-proof<br/>your skin', 'Quaid Day week. Rich creams, body care and winter essentials at holiday prices.', 'Shop winter care', '/shop',
 'Runs 20-25 Dec 2026 (Quaid-e-Azam Day + Christmas). Christmas palette; copy leads with Quaid Day and winter, which fits the market.', 150),

-- ── Lunar-calendar occasions (dates shift ~11 days earlier each year) ───────
('ramadan', 'Ramadan', 'ramadan', null, null,
 'Ramadan Mubarak: sehri-to-iftar essentials', 'RAMADAN',
 'Ramadan Kareem', 'Care for yourself,<br/>sehri to iftar', 'Hydration, supplements and gentle skincare to keep you glowing through the fasts.', 'Shop essentials', '/shop',
 'Lunar: set the window to the whole month each year. Focus on hydration, electrolytes and supplements rather than discounts; the big discounts belong to Chand Raat / Eid.', 160),

('eid-ul-fitr', 'Eid-ul-Fitr Sale', 'eid', null, null,
 'Eid Mubarak: up to 25% off for Chand Raat', 'EIDI',
 'Chand Raat', 'Eid-ready,<br/>head to toe', 'Makeup, fragrance-free glow and last-minute Eidi deals, delivered before the big day.', 'Shop Eid looks', '/shop',
 'Lunar. Start ~10 days before Eid to cover Chand Raat shopping; end the last day of Eid. Makeup is the hero category. Mind courier cutoffs: last COD dispatch is usually 3-4 days before Eid.', 170),

('eid-ul-azha', 'Eid-ul-Azha Sale', 'eid', null, null,
 'Eid Mubarak: festive-week prices inside', 'EIDI',
 'Eid-ul-Azha', 'Glow through<br/>the festivities', 'Skincare that survives the barbecue smoke and guest marathon. Festive prices all week.', 'Shop the sale', '/shop',
 'Lunar. Softer sale than Fitr (spending goes to qurbani): lighter discounts, focus on hosting/self-care angles.', 180),

('ashura', 'Ashura (quiet mode)', 'ramadan', null, null,
 null, null,
 null, null, null, null, null,
 'NOT a sale: 9-10 Muharram is a period of mourning. Activating this only applies the subdued palette with no bar, no coupon and the normal hero. Pause promotional pushes (broadcasts, popups) for these two days.', 190),

('eid-milad', 'Eid Milad-un-Nabi', 'eid', null, null,
 '12 Rabi-ul-Awwal Mubarak', null,
 '12 Rabi-ul-Awwal', 'Eid Milad-un-Nabi Mubarak', 'Marking the day with respect. Nationwide delivery continues as usual.', 'Shop', '/shop',
 'Observance, not a discount day: festive green-gold look, no coupon. Lunar; set the 1-2 day window each year.', 200);
