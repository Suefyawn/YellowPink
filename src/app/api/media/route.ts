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
import { createClient } from '@supabase/supabase-js';
import { authorizeBlogApi } from '@/lib/blog-api';

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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  // Name from the content type, never the client-supplied filename.
  const filename = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('images')
    .upload(filename, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const {
    data: { publicUrl },
  } = supabase.storage.from('images').getPublicUrl(filename);
  return NextResponse.json({ url: publicUrl }, { status: 201 });
}
