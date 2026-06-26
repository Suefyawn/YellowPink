// Public image upload for Medical Review Board photos — used by the doctor
// apply form and the reviewer dashboard so a clinician can attach their photo
// directly instead of pasting a URL. Same tight limits as the review-photo
// upload (small max size, anon allowed, per-IP rate limit).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reviewLimiter, ipFromHeaders } from '@/lib/ratelimit';

const MAX_SIZE = 4 * 1024 * 1024;       // 4 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: NextRequest) {
  const { success } = await reviewLimiter.limit(`upload:reviewer:${ipFromHeaders(req.headers)}`);
  if (!success) return NextResponse.json({ error: 'Too many uploads. Wait a minute.' }, { status: 429 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'JPG, PNG, or WebP only' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Max file size is 4 MB' }, { status: 400 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const ext = extMap[file.type] ?? 'jpg';
  const filename = `reviewers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await sb.storage.from('images').upload(filename, bytes, {
    contentType: file.type, upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = sb.storage.from('images').getPublicUrl(filename);
  return NextResponse.json({ url: publicUrl });
}
