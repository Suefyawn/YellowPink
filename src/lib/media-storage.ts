// ============================================================================
// Shared media upload target for every uploader in the app (staff /api/upload,
// automation /api/media, customer review + reviewer photos).
//
// When the R2 env vars are present, uploads go to Cloudflare R2 and the
// returned public URL lives on R2_PUBLIC_BASE (images.yellowpink.pk) — free
// egress, so image traffic stops burning the Supabase quota that caused the
// Aug 8 plan-restriction outage. Without them, everything falls back to the
// Supabase "images" bucket exactly as before, so this is safe to deploy ahead
// of the env change and in local/preview stacks.
//
// R2 is S3-compatible; aws4fetch does the SigV4 signing without pulling the
// full AWS SDK into the bundle.
// ============================================================================

import { AwsClient } from 'aws4fetch';
import { createClient } from '@supabase/supabase-js';

export function r2Configured(): boolean {
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

/** Upload a media object under `path` (e.g. 'blog/171234-ab12.webp') and
 *  return its public URL. Never throws — callers surface the error string. */
export async function uploadMedia(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<{ url: string } | { error: string }> {
  if (r2Configured()) {
    try {
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
        // Immutable is right for our naming scheme: every upload gets a
        // unique timestamped filename, nothing is ever overwritten in place.
        headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
      });
      if (!r.ok) return { error: `Image upload failed (R2 HTTP ${r.status})` };
      return { url: `${process.env.R2_PUBLIC_BASE!.replace(/\/$/, '')}/${encodeKey(path)}` };
    } catch (err) {
      return { error: `Image upload failed: ${(err as Error).message}` };
    }
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await sb.storage.from('images').upload(path, bytes, { contentType, upsert: false });
  if (error) return { error: error.message };
  return { url: sb.storage.from('images').getPublicUrl(path).data.publicUrl };
}
