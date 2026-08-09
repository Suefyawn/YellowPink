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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB, matching the admin uploader.
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

  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: 'Image type not allowed. Use JPG, PNG, WebP, or AVIF.' },
      { status: 415 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Max file size is 5 MB.' }, { status: 413 });
  }

  // Name from the content type, never the client-supplied filename.
  const filename = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await uploadMedia(filename, await file.arrayBuffer(), file.type);
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ url: res.url }, { status: 201 });
}
