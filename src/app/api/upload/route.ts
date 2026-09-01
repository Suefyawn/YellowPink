import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/staff-auth';
import { uploadLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { uploadMedia } from '@/lib/media-storage';
import { normalizeImageUpload, type ImagePreset } from '@/lib/image-normalize';

// 25 MB inbound: images are normalised server-side (resized + WebP) before
// storage, so a raw phone photo is welcome — what gets stored is small.
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
// Short product clips only, a hard 30 MB cap keeps PDP videos light so they
// don't hurt performance (they're lazy-loaded + never autoplay on the storefront).
const MAX_VIDEO_SIZE = 30 * 1024 * 1024;
// content-type -> file extension. Extension is derived from the type, never the
// user-supplied filename.
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
};
const VIDEO_EXT: Record<string, string> = {
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
};

export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { success } = await uploadLimiter.limit(`${session.id}:${ipFromHeaders(req.headers)}`);
  if (!success) return NextResponse.json({ error: 'Too many uploads. Wait a minute.' }, { status: 429 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  const isImage = file.type in IMAGE_EXT;
  const isVideo = file.type in VIDEO_EXT;
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'File type not allowed (images: JPG, PNG, WebP, AVIF · video: MP4, WebM, MOV)' }, { status: 400 });
  }
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return NextResponse.json({ error: `Max file size is ${isVideo ? 30 : 5} MB` }, { status: 400 });
  }

  // Images are normalised before storage: EXIF-rotated, capped to the
  // preset's box, re-encoded WebP (metadata dropped). The picture is not
  // otherwise altered; unprocessable files pass through as-is. Videos are
  // stored untouched. Preset comes from the uploader ('product' for the
  // product gallery, 'hero' for the blog hero, default 'general').
  let bytes = await file.arrayBuffer();
  let contentType = file.type;
  let ext = IMAGE_EXT[file.type] ?? VIDEO_EXT[file.type] ?? 'bin';
  if (isImage) {
    const presetRaw = (formData.get('preset') as string) ?? 'general';
    const preset: ImagePreset = presetRaw === 'hero' || presetRaw === 'product' ? presetRaw : 'general';
    const out = await normalizeImageUpload(bytes, contentType, preset);
    bytes = out.bytes;
    contentType = out.contentType;
    ext = out.ext;
  }

  // Sanitize extension from the content type, not the user-supplied filename.
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const res = await uploadMedia(filename, bytes, contentType);
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ url: res.url });
}
