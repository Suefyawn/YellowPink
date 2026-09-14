// ============================================================================
// /api/media, token-authed image upload for the blog/automation API.
//
// Companion to /api/blog: an automation or AI content pipeline POSTs an image
// file here and gets back a public URL to use as a post's `image_url`. This
// makes the API self-contained, no admin session needed to host an image.
//
// Auth: the same BLOG_API_TOKEN bearer token as /api/blog (see lib/blog-api).
// Storage: the existing public Supabase "images" bucket, mirroring the admin
// uploader (/api/upload), same allowed types and size cap, but namespaced
// under blog/ so automation uploads stay tidy.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { authorizeBlogApi } from '@/lib/blog-api';
import { uploadMedia } from '@/lib/media-storage';
import { normalizeImageUpload, type ImagePreset } from '@/lib/image-normalize';
import { resolveImageType } from '@/lib/image-sniff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 25 MB inbound, matching the admin uploader: images are normalised
// server-side (resized + WebP) before storage, so what lands in the bucket
// stays small regardless of the source file.
const MAX_SIZE = 25 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

// POST /api/media, multipart/form-data with a "file" field. Returns { url }.
export async function POST(req: NextRequest) {
  const denied = authorizeBlogApi(req);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'Send multipart/form-data with a "file" field.' },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided (form field "file").' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `Max file size is ${MAX_SIZE / (1024 * 1024)} MB.` },
      { status: 413 },
    );
  }

  // Decide the type from the BYTES, not from what the caller said it was.
  // `curl -F "file=@hero.webp"` sends application/octet-stream unless the
  // caller appends ";type=image/webp" by hand, so a type-only check rejected
  // valid WebP heroes with a 415 and no hint as to why. Sniffing also means a
  // caller cannot get a non-image stored by mislabelling it.
  const buf = await file.arrayBuffer();
  const resolved = resolveImageType(buf, file.type, Object.keys(EXT_BY_TYPE));
  const ext = resolved ? EXT_BY_TYPE[resolved] : undefined;
  if (!ext) {
    return NextResponse.json(
      { error: 'Image type not allowed. Use JPG, PNG, WebP, or AVIF.' },
      { status: 415 },
    );
  }

  // Normalise before storing: EXIF-rotate, cap to the preset box, WebP.
  // The automation passes preset=hero for a post's hero (exact 1216x688,
  // AGENTS.md convention); everything else caps the long edge at 2000px.
  const presetRaw = (form.get('preset') as string) ?? 'general';
  const preset: ImagePreset = presetRaw === 'hero' || presetRaw === 'product' ? presetRaw : 'general';
  const out = await normalizeImageUpload(buf, resolved as string, preset);

  // Name from the content type, never the client-supplied filename. The
  // optional "folder" field namespaces the upload (allowlisted so a caller
  // can't write outside the automation's areas); default stays blog/.
  const folderRaw = (form.get('folder') as string) ?? 'blog';
  const folder = folderRaw === 'seasonal' ? 'seasonal' : 'blog';
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${out.processed ? out.ext : ext}`;
  const res = await uploadMedia(filename, out.bytes, out.contentType);
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ url: res.url }, { status: 201 });
}
