// Public image upload for Medical Review Board photos, used by the doctor
// apply form and the reviewer dashboard so a clinician can attach their photo
// directly instead of pasting a URL. Same tight limits as the review-photo
// upload (small max size, anon allowed, per-IP rate limit).

import { NextRequest, NextResponse } from 'next/server';
import { reviewLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { uploadMedia } from '@/lib/media-storage';

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

  const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const ext = extMap[file.type] ?? 'jpg';
  const filename = `reviewers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const res = await uploadMedia(filename, await file.arrayBuffer(), file.type);
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ url: res.url });
}
