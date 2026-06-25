-- ============================================================================
-- Seed the brands table from the catalogue's distinct product.brand strings,
-- with factual landing-page copy for each known brand.
--
-- Idempotent + non-destructive:
--   • ON CONFLICT (slug) DO UPDATE only *fills* a missing description via
--     COALESCE — it never overwrites copy the owner has since edited.
--   • Re-running is safe; rows the owner added by hand are left alone.
--
-- This makes the brand set reproducible from migrations alone (a fresh clone
-- or preview branch gets the same 29 brands + copy), rather than living only
-- as one-off production data. Logos and hero images stay owner-uploadable and
-- are intentionally not seeded — brand marks are the brand's own assets.
-- ============================================================================

insert into public.brands (slug, name, description, status, sort_order) values
  ('cerave', 'CeraVe', 'Developed with dermatologists, CeraVe is the American skincare line built around three essential ceramides and barrier-repair science. Fragrance-free cleansers, moisturisers and SPF for everyday, sensitive-skin-friendly care.', 'published', 100),
  ('the-ordinary', 'The Ordinary', 'Clinical formulations from Canada''s DECIEM, The Ordinary strips skincare back to single, well-studied actives — niacinamide, hyaluronic acid, retinoids — at honest prices and with plain-spoken labels.', 'published', 100),
  ('beauty-of-joseon', 'Beauty of Joseon', 'A Korean skincare house rooted in hanbang — traditional herbal beauty. Time-honoured ingredients like rice, ginseng and propolis are reworked into gentle, glow-giving essences, serums and the cult rice sunscreen.', 'published', 100),
  ('anua', 'Anua', 'Korea''s Anua centres calm, results-driven skincare on heartleaf (Houttuynia cordata) — soothing toners, serums and cleansers loved for quieting redness and balancing oily, blemish-prone skin.', 'published', 100),
  ('axis-y', 'Axis-Y', 'Clean, plant-forward Korean skincare. Axis-Y formulates with traceable botanical actives for a healthy glow, championing minimal, purpose-built routines over crowded shelves.', 'published', 100),
  ('skin1004', 'SKIN1004', 'Named for the Madagascar Centella asiatica at its heart, SKIN1004 brings single-origin centella into lightweight soothing toners, ampoules and the beloved Madagascar Centella sunscreen.', 'published', 100),
  ('mixsoon', 'Mixsoon', 'Minimalist Korean skincare. Mixsoon''s pared-back, low-irritation formulas — led by the cult Bean Essence — focus on gentle daily exfoliation and a clear, well-conditioned complexion.', 'published', 100),
  ('i-m-from', 'I''m From', 'I''m From sources a hero natural ingredient for each product — mugwort, honey, rice — straight from Korean farms, turning them into nourishing masks, toners and essences with a clean ingredient list.', 'published', 100),
  ('celimax', 'Celimax', 'Korean skincare known for its dual-serum formats and targeted actives, Celimax pairs soothing botanicals with brightening and barrier care for sensitive, blemish-prone skin.', 'published', 100),
  ('dr-althea', 'Dr.Althea', 'Derma-driven Korean skincare. Dr.Althea blends clinical actives with calming ingredients in cult favourites like the 345 Relief Cream, focused on barrier repair and a healthy glow.', 'published', 100),
  ('medicube', 'Medicube', 'Korean skin-tech brand pairing dermatology-inspired formulas — Collagen Night Wrapping Mask, Zero Pore line — with at-home beauty devices for a clinic-style routine.', 'published', 100),
  ('glow-recipe', 'Glow Recipe', 'Fruit-powered, K-beauty-inspired skincare from the US. Glow Recipe blends watermelon, plum and avocado with proven actives for the dewy, glass-skin glow it''s famous for.', 'published', 100),
  ('drmtlgy', 'DRMTLGY', 'Dermatologist-inspired American skincare offering high-performance actives and elegant SPF at an accessible price — anti-ageing serums, tinted sunscreens and barrier moisturisers.', 'published', 100),
  ('pixi', 'PIXI', 'British-founded, LA-based PIXI is the brand behind the iconic Glow Tonic — glycolic toners, hydrating serums and dewy makeup designed for soft, lit-from-within skin.', 'published', 100),
  ('rhode', 'Rhode', 'Hailey Bieber''s minimalist skincare line, Rhode keeps it to a tight edit of essentials — the Peptide Glazing Fluid, barrier restore cream and lip treatments — for a clean, dewy look.', 'published', 100),
  ('rare-beauty', 'Rare Beauty', 'Founded by Selena Gomez, Rare Beauty makes lightweight, blendable makeup for every skin tone — the cult Soft Pinch liquid blush among them — alongside a mission to support mental health.', 'published', 100),
  ('fenty-beauty', 'Fenty Beauty', 'Rihanna''s industry-shifting makeup brand, Fenty Beauty set the standard for inclusivity with broad foundation shade ranges, buttery Gloss Bomb and skin-true complexion products.', 'published', 100),
  ('nars', 'NARS', 'French-American makeup house founded by François Nars, known for bold pigment, sculpting blushes (the iconic Orgasm), radiant foundations and an uncompromising editorial point of view.', 'published', 100),
  ('huda-beauty', 'Huda Beauty', 'Built by beauty mogul Huda Kattan in Dubai, Huda Beauty delivers high-impact glam — pigment-rich palettes, lashes, and the best-selling Easy Bake setting powder.', 'published', 100),
  ('anastasia-beverly-hills', 'Anastasia Beverly Hills', 'The brow authority. Anastasia Beverly Hills built its name on brow-shaping pencils, pomades and gels, expanding into richly pigmented eyeshadow palettes and complexion makeup.', 'published', 100),
  ('dior', 'Dior', 'The French luxury maison brings couture to beauty — Dior Addict lip, Forever foundation and Capture skincare — pairing iconic heritage with modern formulas and finishes.', 'published', 100),
  ('kiko-milano', 'Kiko Milano', 'Italian, Milan-born and design-led, KIKO MILANO offers a vast, trend-driven makeup range — from long-wear lip to creamy eyeshadows — at accessible everyday prices.', 'published', 100),
  ('makeup-revolution', 'Makeup Revolution', 'UK-born Makeup Revolution makes trend-forward, cruelty-free makeup accessible to everyone, with fast-moving palettes, foundations and dupes for a fraction of prestige prices.', 'published', 100),
  ('sheglam', 'SHEGLAM', 'SHEGLAM is SHEIN''s in-house beauty label — playful, of-the-moment makeup at pocket-money prices, from blurring foundations to the viral Color Bloom liquid blush.', 'published', 100),
  ('iconic-london', 'Iconic London', 'British makeup brand Iconic London is all about the glow — illuminating drops, radiant complexion sticks and dewy setting sprays for a luminous, lit-from-within finish.', 'published', 100),
  ('tarte', 'Tarte', 'American, cruelty-free and Amazonian-clay powered, Tarte makes long-wear complexion and eye makeup — Shape Tape concealer chief among them — with skin-loving ingredients.', 'published', 100),
  ('real-techniques', 'Real Techniques', 'Created by makeup artists Sam and Nic Chapman, Real Techniques makes affordable, salon-quality brushes and beauty tools designed for flawless, effortless application.', 'published', 100),
  ('christine', 'Christine', 'A long-established cosmetics name in Pakistan, Christine offers an extensive everyday makeup range — lipsticks, powders and nail colour — widely loved for accessibility and broad shade choice.', 'published', 100),
  ('argivital', 'Argivital', 'A wellness supplement brand formulated around L-arginine and supporting nutrients, Argivital is positioned for circulation, energy and everyday vitality support.', 'published', 100)
on conflict (slug) do update
  set description = coalesce(public.brands.description, excluded.description),
      name        = excluded.name;
