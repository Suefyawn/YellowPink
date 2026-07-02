// Stub catalog used when no Supabase env vars are configured. Lets
// `npm run dev` produce a browsable storefront on a fresh clone for
// design / a11y / responsive review.
//
// Never returned in production, gated on `isDemo` in lib/supabase.ts.

import type { BlogPost, Product, Category, Page } from '@/types';

const TS = '2026-05-22T12:00:00.000Z';

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'demo-1', brand: 'CeraVe', name: 'Moisturising Cream', slug: 'demo-cerave-moisturising-cream',
    variant: '454g', price: 4500, original_price: 5800, category: 'Skincare', subcategory: 'Moisturizers',
    tag: 'Bestseller', stock: 32, image_url: undefined,
    description: 'A rich, non-greasy moisturizer formulated with 3 essential ceramides + hyaluronic acid. Suitable for face and body, restores the protective skin barrier.',
    short_description: 'Restores the skin barrier, for face and body.',
    how_to_use: 'Apply liberally to face and body as often as needed.',
    ingredients: 'Aqua, Glycerin, Cetyl Alcohol, Capric Triglyceride, Ceramide NP, Ceramide AP, Ceramide EOP, Niacinamide.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-2', brand: 'RHODE', name: 'Peptide Lip Treatment', slug: 'demo-rhode-peptide-lip',
    variant: 'Vanilla · 10ml', price: 3200, original_price: 3500, category: 'Makeup', subcategory: 'Lip & Cheek Tints',
    tag: 'Sale', stock: 12, image_url: undefined,
    description: 'Hydrating peptide-rich lip treatment with a glossy non-sticky finish. Vanilla scent.',
    short_description: 'Peptide-rich glossy lip treatment.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-3', brand: 'PIXI', name: 'Glow Tonic', slug: 'demo-pixi-glow-tonic',
    variant: '250ml', price: 3800, category: 'Skincare', subcategory: 'Skincare',
    tag: 'Bestseller', stock: 0, image_url: undefined,
    description: '5% glycolic acid + aloe vera + ginseng, refines pores, evens tone, and gives skin that hero glow.',
    short_description: '5% glycolic exfoliating toner.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-4', brand: 'NARS', name: 'Light Reflecting Foundation', slug: 'demo-nars-foundation',
    variant: 'Mont Blanc', price: 12500, category: 'Makeup', subcategory: 'Foundations',
    tag: 'Bestseller', stock: 8, image_url: undefined,
    description: 'Light-reflecting foundation that hydrates, smooths, and corrects with a luminous natural finish.',
    short_description: 'Luminous medium-coverage foundation.',
    kind: 'variable', status: 'published', created_at: TS,
  },
  {
    id: 'demo-5', brand: 'SHEGLAM', name: 'Color Bloom Liquid Blush', slug: 'demo-sheglam-color-bloom',
    variant: 'Cute & Charming', price: 1200, original_price: 1500, category: 'Makeup', subcategory: 'Lip & Cheek Tints',
    tag: 'Sale', stock: 47, image_url: undefined,
    description: 'Buildable liquid blush with a dewy finish. Long-wear pigmented formula.',
    short_description: 'Dewy long-wear liquid blush.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-6', brand: 'Skin1004', name: 'Madagascar Centella Ampoule', slug: 'demo-skin1004-centella',
    variant: '55ml', price: 2900, category: 'Skincare', subcategory: 'Skincare',
    tag: 'Bestseller', stock: 18, image_url: undefined,
    description: '100% Centella Asiatica extract. Soothes, calms, and strengthens stressed skin.',
    short_description: 'Calming Centella Asiatica ampoule.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-7', brand: 'DRMTLGY', name: 'Mineral Sunscreen SPF 45', slug: 'demo-drmtlgy-spf45',
    variant: '88ml', price: 6800, category: 'Skincare', subcategory: 'Sunscreens',
    tag: 'Bestseller', stock: 24, image_url: undefined,
    description: 'Tinted mineral SPF 45 with zinc oxide. Non-comedogenic, water-resistant, blends seamlessly into all skin tones.',
    short_description: 'Tinted mineral SPF 45.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-8', brand: 'YellowPink', name: 'Multivitamin Daily Complete', slug: 'demo-yp-multivitamin',
    variant: '60 tablets', price: 4200, category: 'Wellness', subcategory: 'Human Health',
    tag: 'New', stock: 60, image_url: undefined,
    description: 'A daily multivitamin formulated for South Asian diets. 24 essential nutrients including B-complex, vitamin D3, iron, and biotin.',
    short_description: 'Daily multivitamin · 60 tablets.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-9', brand: 'NOW Foods', name: 'Vitamin D3 5000 IU', slug: 'demo-now-vitamin-d3',
    variant: '120 softgels', price: 2400, category: 'Wellness', subcategory: 'Bone Health',
    tag: 'Bestseller', stock: 38, image_url: undefined,
    description: 'High-potency vitamin D3 to support bone health, immune function, and mood. Sourced from lanolin.',
    short_description: 'High-potency D3 · 120 softgels.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-10', brand: 'Nordic Naturals', name: 'Ultimate Omega', slug: 'demo-nordic-ultimate-omega',
    variant: '60 softgels · lemon', price: 6400, original_price: 7200, category: 'Wellness', subcategory: 'Heart & Cardiovascular',
    tag: 'Sale', stock: 22, image_url: undefined,
    description: 'Triple-strength fish oil with 1280 mg of EPA + DHA per serving. Independently tested for purity and freshness. Natural lemon flavor.',
    short_description: 'Triple-strength fish oil.',
    kind: 'simple', status: 'published', created_at: TS,
  },
];

export const DEMO_CATEGORIES: Category[] = [
  { id: 'demo-cat-1', parent_id: null, slug: 'skincare', name: 'Skincare', description: null, image_url: undefined, sort_order: 0 },
  { id: 'demo-cat-2', parent_id: null, slug: 'makeup',   name: 'Makeup',   description: null, image_url: undefined, sort_order: 1 },
  { id: 'demo-cat-3', parent_id: null, slug: 'wellness', name: 'Wellness', description: null, image_url: undefined, sort_order: 2 },
];

export const DEMO_BLOG_POSTS: BlogPost[] = [
  {
    id: 'demo-blog-1', slug: 'demo-routine-for-pakistani-summer', title: 'A skincare routine for the Pakistani summer',
    excerpt: '5 product swaps that actually work when it\'s 42°C and 80% humidity.', category: 'Skincare',
    date: '2026-05-10', read_time: '4 min read', featured: true, body: undefined, image_url: undefined, created_at: TS,
  },
  {
    id: 'demo-blog-2', slug: 'demo-melasma-truth', title: 'The truth about melasma',
    excerpt: 'What actually helps fade melasma, and why most products don\'t.', category: 'Skincare',
    date: '2026-05-04', read_time: '6 min read', featured: false, body: undefined, image_url: undefined, created_at: TS,
  },
  {
    id: 'demo-blog-3', slug: 'demo-supplements-101', title: 'Supplements 101 for South Asian women',
    excerpt: 'Why vitamin D, B12, and iron deficiencies are so common, and what to do.', category: 'Wellness',
    date: '2026-04-28', read_time: '5 min read', featured: false, body: undefined, image_url: undefined, created_at: TS,
  },
];

// CMS-like pages, match the slugs in `src/lib/page-faqs.ts` so the FAQ
// JSON-LD + accordion can preview end-to-end without a database.
export const DEMO_PAGES: Page[] = [
  {
    id: 'demo-page-shipping', slug: 'shipping', title: 'Shipping Policy',
    status: 'published', show_in_footer: true, sort_order: 1,
    meta_title: 'Shipping Policy | Yellow Pink',
    meta_description: 'Delivery timelines, cash-on-delivery, free-shipping thresholds, and courier partners across Pakistan.',
    excerpt: 'How orders ship across Pakistan.',
    body_html: '<p>Yellow Pink ships to all major cities and most remote areas across Pakistan via TCS, Leopards, M&amp;P and BlueEx. Orders placed before 2 PM ship the same working day.</p><p>Cash on Delivery is available nationwide. Orders over PKR 5,000 ship free; below that a flat fee is calculated at checkout based on your city.</p>',
  },
  {
    id: 'demo-page-returns', slug: 'returns', title: 'Returns & Refunds',
    status: 'published', show_in_footer: true, sort_order: 2,
    meta_title: 'Returns & Refunds | Yellow Pink',
    meta_description: 'Our 7-day return window, who pays for return shipping, and how refunds are issued.',
    excerpt: 'How returns and refunds work.',
    body_html: '<p>You can request a return within 7 days of delivery for unopened items in their original packaging. Damaged or wrong-item shipments are returned at our cost; other reasons are returned at the customer\'s cost.</p><p>Refunds are issued as store credit by default, fast, with no payment-processor delay. Cash refunds for COD orders are available on request and take up to 5 working days.</p>',
  },
  {
    id: 'demo-page-faq', slug: 'faq', title: 'Frequently Asked Questions',
    status: 'published', show_in_footer: true, sort_order: 3,
    meta_title: 'FAQ | Yellow Pink',
    meta_description: 'Common questions about authenticity, order tracking, payment methods, and customer support.',
    excerpt: 'Common questions, answered.',
    body_html: '<p>Browse the most common questions about Yellow Pink. Don\'t see your answer? <a href="/page/contact">Contact us</a> and we\'ll respond within one working day.</p>',
  },
  {
    id: 'demo-page-about', slug: 'about', title: 'About Yellow Pink',
    status: 'published', show_in_footer: true, sort_order: 4,
    meta_title: 'About Us | Yellow Pink',
    meta_description: 'Yellow Pink imports beauty, skincare and wellness from international brands and delivers across Pakistan with COD.',
    excerpt: 'Imported beauty & wellness for Pakistan.',
    body_html: '<p>Yellow Pink imports skincare, makeup, and clinical-grade nutraceuticals from international brands and delivers them across Pakistan with cash on delivery. Real beauty starts with real ingredients, and real results.</p>',
  },
  {
    id: 'demo-page-contact', slug: 'contact', title: 'Contact Us',
    status: 'published', show_in_footer: true, sort_order: 5,
    meta_title: 'Contact | Yellow Pink',
    meta_description: 'Get in touch with Yellow Pink customer support.',
    excerpt: 'Get in touch.',
    body_html: '<p>Reach us at <a href="mailto:hello@yellowpink.pk">hello@yellowpink.pk</a> Monday to Saturday. Most enquiries are answered within one working day.</p>',
  },
];

export const DEMO_SITE_SETTINGS: Record<string, string> = {
  store_name: 'Yellow Pink',
  store_email: 'hello@yellowpink.pk',
  currency: 'PKR',
  free_shipping_threshold: '5000',
  default_shipping_rate: '200',
  announcement_active: 'true',
  announcement_text: 'DEMO MODE · Imported beauty & wellness · COD nationwide',
  announcement_color: '#111827',
  hero_headline: 'Beautiful skin.',
  hero_subline: 'A demo storefront so you can review the UI without setting up Supabase. Wire env vars to see the real catalog.',
  hero_cta1_text: 'Shop Beauty',
  hero_cta1_url: '/shop',
  hero_cta2_text: 'Explore Wellness',
  hero_cta2_url: '/shop?category=Wellness',
  hero_brands: 'NARS,Kiko Milano,PIXI,CeraVe,SHEGLAM,RHODE',
};
