-- ============================================================================
-- Seed the editorial reviewers. In production these rows were created through
-- the admin UI, not a migration, so a from-scratch build has an empty
-- content_reviewers table — and 20260626_216 (and later blog content
-- migrations) insert posts with a reviewer_id FK into this table, which failed
-- with a foreign-key violation. This sorts after the table is created (201)
-- and before the first blog post that references a reviewer (216).
-- Guarded so re-running against a populated database is a no-op.
-- ============================================================================

INSERT INTO content_reviewers (id, slug, name, credentials, specialty, is_default, active, sort_order, review_topics) VALUES
('67065511-cddf-4dc3-ab58-ff38027f8277','atiqa-zafar','Atiqa Zafar','D Pharmacy','Pharmacist',false,false,0,array['Medicines']),
('e9eb1e8a-fec8-43d0-8eee-77f6c5ac70b5','areej-saeed','Dr. Areej Saeed','MBBS','Medicine, Surgery, Radiology, Gastroenterology',true,true,0,array['Women''s Health','Men''s Health','Fertility','Bone & Joint','Skincare','Hair Care']),
('4cb664a8-3ec4-4b95-a5c8-9e4713bb046f','muneeba-zafar','Dr. Muneeba Zafar','MBBS FCPS','General Surgery',false,true,1,array['Women’s health','Supplements','Fertility']),
('0048c7cc-88db-45a0-a03d-c555c6c12612','ehsan-ali','Dr. Ehsan Ali','MBBS FCPS','Critical Care Medicine',false,true,2,array['Medicine']),
('9d886c5d-8e0e-430d-91f8-e6a3ceca87c8','ali-raza','Dr. Ali Raza','MBBS FCPS','Neurosciences',false,true,3,array['Brain Health and Nervous System'])
ON CONFLICT (id) DO NOTHING;
