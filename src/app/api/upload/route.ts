import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStaffSession } from '@/lib/staff-auth';
import { uploadLimiter, ipFromHeaders } from '@/lib/ratelimit';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // Sanitize extension from the content type, not the user-supplied filename.
  const ext = IMAGE_EXT[file.type] ?? VIDEO_EXT[file.type] ?? 'bin';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from('images')
    .upload(filename, bytes, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filename);
  return NextResponse.json({ url: publicUrl });
}
