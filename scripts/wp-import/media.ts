// Image downloader → Supabase Storage uploader.
//
// Idempotent: each WP media item is keyed by `wp_media_id`. If a row for
// that id already exists in `product_images`, the file path is reused.
// Otherwise we download the original file, upload to the `images/` bucket
// with a slug-friendly filename, and return the public URL.

import { createHash } from 'node:crypto';
import path from 'node:path';
import { CONFIG } from './config';
import { sb } from './sb';
import { log } from './log';

const BUCKET = CONFIG.sb.bucket;

interface WpMedia {
  id: number;
  source_url: string;
  alt_text?: string;
  title?: { rendered?: string };
  media_details?: { width?: number; height?: number; sizes?: Record<string, { source_url: string }> };
}

// Already-uploaded cache for the current run.
const inFlight = new Map<number, Promise<{ url: string; mediaId: number } | null>>();

// Resolve to the public URL of a freshly-uploaded (or already-uploaded) file.
export async function uploadIfNeeded(media: WpMedia): Promise<{ url: string; mediaId: number } | null> {
  if (CONFIG.skipMedia) return { url: media.source_url, mediaId: media.id };
  if (inFlight.has(media.id)) return inFlight.get(media.id)!;

  const p = (async () => {
    try {
      // Use the WP file extension when possible; default to .jpg.
      const ext = (path.extname(new URL(media.source_url).pathname) || '.jpg').toLowerCase();
      // Stable, collision-proof filename: <wpid>-<sha1(url)[:8]>.<ext>
      const hash = createHash('sha1').update(media.source_url).digest('hex').slice(0, 8);
      const filename = `wp/${media.id}-${hash}${ext}`;

      // Stream the file from WP. Cloudflare-fronted WP hosts (which
      // yellowpink.pk is) block Node fetch's default empty UA with a 503;
      // a real-looking User-Agent gets past that.
      const res = await fetch(media.source_url, {
        headers: {
          'User-Agent':      'YellowPink-WP-Importer/1.0 (+https://yellowpink.pk)',
          'Accept-Language': 'en-US,en;q=0.9',
          Accept:            'image/*,*/*;q=0.8',
        },
      });
      if (!res.ok) {
        log.warn(`media ${media.id}: ${res.status} fetching ${media.source_url}`);
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';

      if (CONFIG.dryRun) return { url: media.source_url, mediaId: media.id };

      const { error } = await sb.storage
        .from(BUCKET)
        .upload(filename, buf, { contentType, upsert: true });
      if (error) {
        log.warn(`media ${media.id}: storage upload failed: ${error.message}`);
        return null;
      }
      const { data } = sb.storage.from(BUCKET).getPublicUrl(filename);
      return { url: data.publicUrl, mediaId: media.id };
    } catch (err) {
      log.warn(`media ${media.id}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  })();

  inFlight.set(media.id, p);
  return p;
}

// Inline helper used by importers that get a media object (id + source_url) as
// part of a parent payload (e.g. category.image, product.images[]).
export async function pickAndUpload(media: WpMedia | null | undefined): Promise<{ url: string | null; mediaId: number | null }> {
  if (!media) return { url: null, mediaId: null };
  const r = await uploadIfNeeded(media);
  return { url: r?.url ?? null, mediaId: r?.mediaId ?? media.id };
}
