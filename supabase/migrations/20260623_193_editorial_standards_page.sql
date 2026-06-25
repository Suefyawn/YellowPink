-- E-E-A-T: an honest "Editorial Standards" CMS page describing how Yellow Pink
-- researches, writes, reviews and updates its beauty/wellness content, and that
-- it is not a substitute for medical advice. Linked from the medical disclaimer
-- on health articles and from the footer. Strengthens trust signals for YMYL
-- content without fabricating credentials.
insert into pages (slug, title, body_html, excerpt, status, meta_title, meta_description, show_in_footer, sort_order)
values (
  'editorial-standards',
  'Editorial Standards',
  $html$<p>Yellow Pink publishes beauty and wellness articles to help our customers make informed choices. This page explains how that content is created and the standards we hold it to.</p>
<h2>Who writes our content</h2>
<p>Our articles are researched and written by the Yellow Pink editorial team &mdash; writers who focus on skincare, makeup and nutritional supplements. Where an article carries a named author, that person is responsible for its content.</p>
<h2>How we research</h2>
<p>We base our health and wellness content on reputable, publicly available sources &mdash; including peer-reviewed research, recognised health organisations, and the verified information supplied by product manufacturers and on product labels. We describe what ingredients and products are generally understood to do; we do not promise specific individual results.</p>
<h2>Accuracy and updates</h2>
<p>We review our articles periodically and update them as information changes. Science evolves and, despite our best efforts, errors can occur. The &ldquo;last updated&rdquo; date shown on an article reflects our most recent review.</p>
<h2>Not a substitute for medical advice</h2>
<p>Our content is for general education only. It is not medical advice and is not intended to diagnose, treat, cure or prevent any disease. Supplements affect everyone differently &mdash; always consult a qualified doctor or pharmacist before starting one, especially if you are pregnant, breastfeeding, taking medication or managing a health condition. See our full <a href="/page/disclaimer">disclaimer</a>.</p>
<h2>Tell us if something is wrong</h2>
<p>If you spot an inaccuracy in any article, please message us on <a href="https://wa.me/923004374577">WhatsApp (+92 300 4374577)</a>. We take corrections seriously and will review promptly.</p>$html$,
  'How Yellow Pink researches, writes and reviews its beauty and wellness content.',
  'published',
  'Editorial Standards | Yellow Pink',
  'How Yellow Pink researches, writes, reviews and updates its beauty and wellness content — and why it is not a substitute for professional medical advice.',
  false,
  6
);
