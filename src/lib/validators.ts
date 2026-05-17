// ============================================================================
// Zod validation schemas. Reuse on both server (actions, route handlers) and
// client. Phase 1.9.
//
// Every server action that takes user-controlled FormData should pipe through
// one of these helpers — the existing validateProduct / validateBlogPost
// inline checks in src/app/admin/actions.ts can migrate to these.
// ============================================================================

import { z } from 'zod';

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

export const positiveNumber = z.coerce.number().nonnegative('Must be 0 or more');
export const positiveInt    = z.coerce.number().int().nonnegative('Must be a whole number');

// ─── Domain schemas ─────────────────────────────────────────────────────────
export const productInputSchema = z.object({
  brand:          z.string().trim().min(1, 'Brand is required').max(80),
  name:           z.string().trim().min(1, 'Product name is required').max(200),
  variant:        z.string().trim().max(80).optional().nullable(),
  price:          positiveNumber,
  original_price: positiveNumber.optional().nullable(),
  category:       z.string().trim().min(1, 'Category is required').max(80),
  subcategory:    z.string().trim().max(120).optional().nullable(),
  tag:            z.enum(['New','Sale','Bestseller','Featured','Limited']).optional().nullable(),
  slug:           slugSchema,
  stock:          positiveInt,
  image_url:      httpsUrlSchema.optional().or(z.literal('')).nullable(),
  description:    z.string().max(8000).optional().nullable(),
  how_to_use:     z.string().max(8000).optional().nullable(),
  ingredients:    z.string().max(8000).optional().nullable(),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const blogPostInputSchema = z.object({
  title:     z.string().trim().min(1, 'Title is required').max(200),
  slug:      slugSchema,
  excerpt:   z.string().trim().min(1, 'Excerpt is required').max(300),
  category:  z.string().trim().min(1, 'Category is required'),
  date:      z.string().min(1, 'Date is required'),
  read_time: z.string().trim().default('3 min read'),
  featured:  z.boolean().default(false),
  body:      z.string().optional().nullable(),
  image_url: httpsUrlSchema.optional().or(z.literal('')).nullable(),
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
  product_id:  z.string().uuid(),
  author_name: z.string().trim().min(1).max(120),
  rating:      z.coerce.number().int().min(1).max(5),
  body:        z.string().trim().min(10, 'Review must be at least 10 characters').max(4000),
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
  is_default: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────
// Pull a key from FormData if present, else undefined.
function fdGet(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === 'string' ? v : undefined;
}

// Parse a FormData into a flat object suitable for Zod parsing.
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') obj[k] = v;
  }
  // checkboxes don't appear in FormData when unchecked — normalise.
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
