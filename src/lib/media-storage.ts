// ============================================================================
// Shared media upload target for every uploader in the app (staff /api/upload,
// automation /api/media, customer review + reviewer photos).
//
// Everything lands in the Cloudflare R2 bucket behind R2_PUBLIC_BASE
// (images.yellowpink.pk): free egress, so image traffic never touches the
// Supabase quota again (the Aug 8 plan-restriction outage). On Workers the
// write goes through the MEDIA bucket binding; on Node (Vercel, scripts) it is
// a SigV4-signed S3 PUT via aws4fetch. The old Supabase Storage fallback is
// gone: no site media has lived there since Aug 2026.
// ============================================================================

import { AwsClient } from 'aws4fetch';
import { bindings } from '@/lib/platform';

export function r2Configured(): boolean {
  if (bindings().MEDIA && process.env.R2_PUBLIC_BASE) return true;
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_BASE,
  );
}

// Object keys keep readable path segments; encode each segment so spaces and
// unicode in legacy filenames survive both the signed PUT and the public URL.
const encodeKey = (path: string) => path.split('/').map(encodeURIComponent).join('/');

// Immutable is right for our naming scheme: every upload gets a unique
// timestamped filename, nothing is ever overwritten in place.
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Upload a media object under `path` (e.g. 'blog/171234-ab12.webp') and
 *  return its public URL. Never throws — callers surface the error string. */
export async function uploadMedia(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<{ url: string } | { error: string }> {
  if (!r2Configured()) return { error: 'Image upload is not configured (R2)' };
  const publicUrl = `${process.env.R2_PUBLIC_BASE!.replace(/\/$/, '')}/${encodeKey(path)}`;
  try {
    const media = bindings().MEDIA;
    if (media) {
      // The binding takes the un-encoded key; R2 serves it at the encoded URL.
      await media.put(path, bytes, { httpMetadata: { contentType, cacheControl: CACHE_CONTROL } });
      return { url: publicUrl };
    }
    const client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      service: 's3',
      region: 'auto',
    });
    const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${encodeKey(path)}`;
    const r = await client.fetch(endpoint, {
      method: 'PUT',
      body: bytes,
      // Content-Length is set explicitly: when the runtime streams the body
      // (observed when the INBOUND request arrived chunked), R2 rejects the
      // unsized PUT with 411 Length Required (1 Sep 2026, blog-automation
      // upload failures).
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': CACHE_CONTROL,
      },
    });
    if (!r.ok) return { error: `Image upload failed (R2 HTTP ${r.status})` };
    return { url: publicUrl };
  } catch (err) {
    return { error: `Image upload failed: ${(err as Error).message}` };
  }
}
