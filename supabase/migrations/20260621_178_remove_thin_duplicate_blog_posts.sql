-- Remove the thin (~300-450 word) launch posts that duplicate existing
-- long-form posts on the same head term, causing keyword cannibalisation.
-- The existing March 2026 posts (ashwagandha-benefits-pakistan-stress-energy-guide,
-- collagen-supplements-pakistan-buyers-guide-2026, biotin-hair-loss-pakistan-...,
-- magnesium-for-sleep-pakistan) own these topics and stay.
delete from blog_posts where slug in (
  'ashwagandha-benefits-uses-dosage-pakistan',
  'collagen-supplements-guide-pakistan',
  'biotin-hair-skin-nails-pakistan',
  'magnesium-glycinate-benefits-pakistan'
);
