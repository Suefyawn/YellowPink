// ============================================================================
// Zod validation schemas. Reuse on both server (actions, route handlers) and
// client. Phase 1.9.
//
// Every server action that takes user-controlled FormData should pipe through
// one of these helpers, the existing validateProduct / validateBlogPost
// inline checks in src/app/admin/actions.ts can migrate to these.
// ============================================================================

import { z } from 'zod';
import type { ProductKeyBenefit, ProductFaqItem } from '@/types';

// ─── Primitives ─────────────────────────────────────────────────────────────
export const slugSchema = z.string()
  .min(1, 'Slug is required')
  .max(120, 'Slug too long')
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only');

export const emailSchema = z.string().email('Enter a valid email address');

// Pakistani mobile: optional +92 / 0092 / 0 prefix, then 3xxxxxxxxx.
export const pkPhoneSchema = z.string()
  .transform(s => s.replace(/\s+/g, ''))
  .pipe(
    z.string().regex(/^(\+92|0092|0)?3\d{9}$/, 'Enter a valid Pakistani mobile number (e.g. 03001234567)')
  );

export const httpsUrlSchema = z.string()
  .refine(u => /^https?:\/\//i.test(u), 'URL must start with http:// or https://');

// Like httpsUrlSchema but also accepts a site-relative path (e.g.
// /blog-heroes/foo.webp). Locally-hosted hero/cover images are stored as
// root-relative paths, so an absolute https URL must not be required, otherwise
// editing such a post in the admin fails validation on the image field.
export const imageRefSchema = z.string()
  .refine(u => /^https?:\/\//i.test(u) || u.startsWith('/'), 'Must be an https URL or a /path');

export const positiveNumber = z.coerce.number().nonnegative('Must be 0 or more');
export const positiveInt    = z.coerce.number().int().nonnegative('Must be a whole number');

// A FormData checkbox/toggle value coerced to a real boolean. Forms submit
// booleans as strings: native checkboxes send 'on' when ticked and are absent
// when unticked, while the admin `Toggle` sends the string 'true'/'false'.
// A bare `z.boolean()` rejects any of these ("Expected boolean, received
// string"), so schema fields fed from a form must use this instead.
export const checkboxBool = z.preprocess(
  v => v === 'on' || v === 'true' || v === true,
  z.boolean(),
);

// ─── Domain schemas ─────────────────────────────────────────────────────────
export const productInputSchema = z.object({
  // Brand is optional after migration 077, own-label Pakistani supplements
  // don't have a consumer-facing brand. An empty string from the form
  // normalises to null at the DB level (NULL is now allowed).
  brand:          z.string().trim().max(80).transform(s => s || null).nullable(),
  name:           z.string().trim().min(1, 'Product name is required').max(200),
  variant:        z.string().trim().max(80).optional().nullable(),
  kind:           z.enum(['simple','variable','bundle','external']).default('simple'),
  price:          positiveNumber,
  original_price: positiveNumber.optional().nullable(),
  category:       z.string().trim().min(1, 'Category is required').max(80),
  subcategory:    z.string().trim().max(120).optional().nullable(),
  // The admin form always submits `tag`, as '' when no tag is chosen.
  // Preprocess '' / null / undefined → null so the enum doesn't reject the
  // empty option, otherwise saving a product with no tag fails.
  tag:            z.preprocess(
                    v => (v === '' || v == null ? null : v),
                    z.enum(['New','Sale','Bestseller','Featured','Limited']).nullable(),
                  ),
  slug:           slugSchema,
  // Publication status. The admin form always submits it (new products
  // default to 'draft' there); optional so older callers that never sent a
  // status keep the DB value untouched (undefined keys are dropped by
  // supabase-js, so an update without status leaves it as-is).
  status:         z.enum(['draft','published','archived']).optional(),
  stock:          positiveInt,
  // Per-product reorder point (0 = off → global low-stock threshold). The form
  // always submits it; '' / missing normalises to 0.
  reorder_point:  z.preprocess(v => (v === '' || v == null ? 0 : v), positiveInt),
  // Merchandising flags. Native checkboxes submit 'on' when ticked and are
  // absent when unticked, so preprocess undefined → false. These booleans
  // drive the homepage rails and the `featured`/`bestseller` smart-collection
  // rules (distinct from the free-text `tag` badge above).
  is_featured:    z.preprocess(v => v === 'on' || v === 'true' || v === true, z.boolean()),
  is_bestseller:  z.preprocess(v => v === 'on' || v === 'true' || v === true, z.boolean()),
  // Inventory tracking toggle. The product form always submits 'true'/'false'
  // via a hidden input. A missing value stays absent (undefined keys are
  // dropped by supabase-js) so a CSV import without the column can't flip
  // externally-managed products back to tracked on upsert; new inserts fall
  // through to the DB default (true).
  track_inventory: z.preprocess(
                    v => (v == null ? undefined : v === 'true' || v === true || v === 'on'),
                    z.boolean().optional(),
                  ),
  // Sourcing vendor + per-unit cost. The form submits '' for "no vendor" and
  // an empty cost; both normalise to null.
  vendor_id:      z.preprocess(
                    v => (v === '' || v == null ? null : v),
                    z.string().uuid().nullable(),
                  ),
  vendor_cost:    z.preprocess(
                    v => (v === '' || v == null ? null : v),
                    positiveNumber.nullable(),
                  ),
  // Own-stock acquisition cost per unit (used by Finance COGS for non-vendor
  // items). Empty form value normalises to null.
  cost_price:     z.preprocess(
                    v => (v === '' || v == null ? null : v),
                    positiveNumber.nullable(),
                  ),
  image_url:      httpsUrlSchema.optional().or(z.literal('')).nullable(),
  // Optional short product video (PDP gallery slide). Empty string from the
  // form normalises to null.
  video_url:      httpsUrlSchema.optional().or(z.literal('')).transform(s => s || null).nullable(),
  description:    z.string().max(8000).optional().nullable(),
  short_description: z.string().max(1000).optional().nullable(),
  how_to_use:     z.string().max(8000).optional().nullable(),
  ingredients:    z.string().max(8000).optional().nullable(),
  // Migration 081, admin-controlled SEO + content fields. Empty string
  // from the form normalises to null at the DB level.
  seo_title:        z.string().trim().max(120).transform(s => s || null).nullable().optional(),
  seo_description: z.string().trim().max(220).transform(s => s || null).nullable().optional(),
  og_image_url:    z.string().trim().max(500).transform(s => s || null).nullable().optional(),
  usage_tips:      z.string().max(8000).optional().nullable(),
  social_proof:    z.string().trim().max(500).transform(s => s || null).nullable().optional(),
  // key_benefits and faq come in as JSON strings from a textarea and need
  // shape validation. Empty string normalises to null.
  key_benefits: z.string()
    .transform((s, ctx) => {
      const trimmed = s?.trim() ?? '';
      if (!trimmed) return null;
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) throw new Error('not an array');
        for (const item of parsed) {
          if (!item || typeof item !== 'object' || typeof item.text !== 'string') {
            throw new Error('each item needs a `text` string');
          }
        }
        return parsed as ProductKeyBenefit[];
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `key_benefits must be a JSON array of {icon?, text}, ${(e as Error).message}`,
        });
        return z.NEVER;
      }
    })
    .nullable()
    .optional(),
  faq: z.string()
    .transform((s, ctx) => {
      const trimmed = s?.trim() ?? '';
      if (!trimmed) return null;
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) throw new Error('not an array');
        for (const item of parsed) {
          if (!item || typeof item !== 'object' || typeof item.q !== 'string' || typeof item.a !== 'string') {
            throw new Error('each item needs `q` and `a` strings');
          }
        }
        return parsed as ProductFaqItem[];
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `faq must be a JSON array of {q, a}, ${(e as Error).message}`,
        });
        return z.NEVER;
      }
    })
    .nullable()
    .optional(),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const variantInputSchema = z.object({
  product_id: z.string().uuid(),
  sku:        z.string().trim().max(80).optional().or(z.literal('')).nullable(),
  price:      positiveNumber,
  compare_at_price: positiveNumber.optional().nullable(),
  stock:      positiveInt,
  image_url:  httpsUrlSchema.optional().or(z.literal('')).nullable(),
  // Native checkbox paired with a hidden 'false' input, so an unticked box
  // submits 'false' and actually disables the variant. A missing value (older
  // callers) keeps the enabled default. A bare z.coerce.boolean() here both
  // ignored the unticked box (absent → default true) and would treat the
  // string 'false' as truthy (Boolean('false') === true).
  enabled:    z.preprocess(
                v => (v == null ? true : v === 'true' || v === true || v === 'on'),
                z.boolean(),
              ),
  sort_order: positiveInt.default(0),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

export const blogPostInputSchema = z.object({
  title:     z.string().trim().min(1, 'Title is required').max(200),
  slug:      slugSchema,
  excerpt:   z.string().trim().min(1, 'Excerpt is required').max(300),
  category:  z.string().trim().min(1, 'Category is required'),
  // Fixed reviewer-topic catalogue value (see lib/review-topics). Drives the
  // direct reviewer↔article match. Empty ("no specific topic") → null.
  topic:     z.preprocess(v => (v === '' || v == null ? null : v), z.string().max(80).nullable()),
  // ISO 'YYYY-MM-DD' only, matching the admin form's native <input type="date">.
  // A free-text field here previously let imported rows in as e.g. "June 30,
  // 2026", a value that sorts wrong against ISO dates as plain text and isn't
  // valid ISO 8601 for the Article datePublished structured data.
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  read_time: z.string().trim().default('3 min read'),
  featured:  checkboxBool,
  body:      z.string().optional().nullable(),
  image_url: imageRefSchema.optional().or(z.literal('')).nullable(),
  author:    z.string().trim().max(120).optional().or(z.literal('')).nullable(),
  // Medical Review Board assignment, empty string (the "None" option) → null.
  reviewer_id: z.preprocess(
    v => (v === '' || v == null ? null : v),
    z.string().uuid().nullable(),
  ),
});
export type BlogPostInput = z.infer<typeof blogPostInputSchema>;

export const checkoutSchema = z.object({
  email:      z.string().email().optional().or(z.literal('')),
  firstName:  z.string().trim().min(1).max(80),
  lastName:   z.string().trim().min(1).max(80),
  phone:      pkPhoneSchema,
  address:    z.string().trim().min(5).max(300),
  city:       z.string().trim().min(1).max(120),
  province:   z.string().optional(),
  zip:        z.string().regex(/^[0-9-]*$/).max(12).optional().or(z.literal('')),
  payMethod:  z.enum(['cod','card','bank','jazzcash','easypaisa','gift_card']),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const reviewSchema = z.object({
  product_id:    z.string().uuid(),
  author_name:   z.string().trim().min(1).max(120),
  reviewer_email: z.string().email().optional().or(z.literal('')),
  rating:        z.coerce.number().int().min(1).max(5),
  body:          z.string().trim().min(10, 'Review must be at least 10 characters').max(4000),
  // Comma-separated list of already-uploaded image URLs (uploaded via /api/upload/review).
  photo_urls:    z.string().optional().or(z.literal('')),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const couponSchema = z.object({
  code:       z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/, 'Letters, numbers, hyphens and underscores only').max(40),
  type:       z.enum(['percent','fixed']),
  value:      z.coerce.number().positive(),
  min_order:  z.coerce.number().nonnegative().default(0),
  max_uses:   z.coerce.number().int().positive().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});
export type CouponInput = z.infer<typeof couponSchema>;

export const addressSchema = z.object({
  label:      z.string().trim().max(40).optional().nullable(),
  first_name: z.string().trim().min(1).max(80),
  last_name:  z.string().trim().min(1).max(80),
  phone:      pkPhoneSchema,
  line1:      z.string().trim().min(3).max(200),
  line2:      z.string().trim().max(200).optional().nullable(),
  city:       z.string().trim().min(1).max(120),
  province:   z.string().trim().max(60).optional().nullable(),
  zip:        z.string().regex(/^[0-9-]*$/).max(12).optional().nullable(),
  is_default: checkboxBool,
});
export type AddressInput = z.infer<typeof addressSchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────
// Pull a key from FormData if present, else undefined.
function fdGet(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === 'string' ? v : undefined;
}

// Read a checkbox/toggle boolean straight out of FormData, for actions that
// don't pipe through a Zod schema. The admin `Toggle` renders a hidden
// `<input value="false">` immediately followed by the checkbox
// `<input value="true">`, so both keys are submitted and the checkbox (the
// LAST value) must win. `formData.get()` returns the FIRST match ('false') and
// is therefore always false — use this instead. Native checkboxes send 'on'.
export function boolField(fd: FormData, name: string): boolean {
  const values = fd.getAll(name);
  const last = values[values.length - 1];
  return last === 'true' || last === 'on';
}

// Parse a FormData into a flat object suitable for Zod parsing.
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') obj[k] = v;
  }
  // checkboxes don't appear in FormData when unchecked, normalise.
  return obj;
}

export function parseForm<T extends z.ZodType>(schema: T, fd: FormData) {
  return schema.safeParse(formDataToObject(fd));
}

// Turn a ZodError into a single user-facing message (first issue is fine for forms).
export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Invalid input';
}

// Re-export so call-sites only depend on this module.
export { fdGet, z };
