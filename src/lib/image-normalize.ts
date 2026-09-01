// ============================================================================
// Server-side image normalisation for every uploader (owner directive,
// 1 Sep 2026: "when uploaded the image is automatically tailored to the
// version that suits us without messing with the image itself").
//
// What it does to an image, in order:
//   1. auto-rotates using the EXIF orientation (phones lie on their side),
//   2. resizes DOWN to the target box (never upscales),
//   3. re-encodes as WebP at quality 82 — visually indistinguishable, and
//      typically 5-20x smaller than a phone camera JPEG,
//   4. drops EXIF/GPS metadata as a side effect of re-encoding (privacy).
//
// It deliberately does NOT sharpen, crop (except the hero preset's cover
// crop), filter, or watermark — the picture itself is untouched.
//
// Fail-open: if sharp can't decode the bytes, the caller stores the original
// exactly as before, so an odd-but-valid file never blocks an upload.
// ============================================================================

// (No 'server-only' guard: sharp itself refuses to load in a browser bundle,
// and the unit tests import this module directly under vitest's node env.)

export type ImagePreset = 'general' | 'hero' | 'product';

interface PresetSpec {
  width: number;
  height: number | null; // null = free height, fit inside width
  fit: 'inside' | 'cover';
}

const PRESETS: Record<ImagePreset, PresetSpec> = {
  /** Blog-body images, review photos, anything free-form: cap the long edge. */
  general: { width: 2000, height: 2000, fit: 'inside' },
  /** Blog hero: the exact 1216x688 the design system expects (AGENTS.md). */
  hero: { width: 1216, height: 688, fit: 'cover' },
  /** Product gallery: square-ish catalogue shots, capped at 1600. */
  product: { width: 1600, height: 1600, fit: 'inside' },
};

const PROCESSABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export interface NormalizedImage {
  bytes: ArrayBuffer;
  contentType: string;
  ext: string;
  /** False = passthrough (unprocessable type or decode failure). */
  processed: boolean;
}

/** Normalise an uploaded image per the preset. Never throws. */
export async function normalizeImageUpload(
  bytes: ArrayBuffer,
  contentType: string,
  preset: ImagePreset = 'general',
): Promise<NormalizedImage> {
  const passthrough: NormalizedImage = {
    bytes, contentType,
    ext: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[contentType] ?? 'bin',
    processed: false,
  };
  if (!PROCESSABLE.has(contentType)) return passthrough;

  try {
    // Dynamic import: sharp is a native module; loading it lazily keeps it
    // out of every route's cold-start that never touches an upload.
    const sharp = (await import('sharp')).default;
    const spec = PRESETS[preset];
    const img = sharp(Buffer.from(bytes), { failOn: 'error' }).rotate(); // EXIF orientation

    const meta = await img.metadata();
    // Animated inputs (animated WebP) would be flattened to frame one —
    // that WOULD mess with the image, so pass them through untouched.
    if ((meta.pages ?? 1) > 1) return passthrough;

    const out = await img
      .resize(spec.width, spec.height ?? undefined, {
        fit: spec.fit,
        withoutEnlargement: spec.fit === 'inside',
        position: 'attention', // hero cover-crops toward the subject
      })
      .webp({ quality: 82 })
      .toBuffer();

    // If processing somehow grew the file (already-tiny optimised WebP),
    // keep the smaller original.
    if (out.byteLength >= bytes.byteLength && contentType === 'image/webp') return passthrough;

    return {
      bytes: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer,
      contentType: 'image/webp',
      ext: 'webp',
      processed: true,
    };
  } catch {
    return passthrough;
  }
}
