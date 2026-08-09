// Customer-facing image upload for review photos. Tighter limits than the
// staff /api/upload route (smaller max size, lower per-IP rate, anon allowed).

import { NextRequest, NextResponse } from 'next/server';
import { reviewLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { uploadMedia } from '@/lib/media-storage';

const MAX_SIZE = 3 * 1024 * 1024;       // 3 MB per review photo
const MAX_PER_REQUEST = 1;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: NextRequest) {
  const { success } = await reviewLimiter.limit(`upload:${ipFromHeaders(req.headers)}`);
  if (!success) return NextResponse.json({ error: 'Too many uploads. Wait a minute.' }, { status: 429 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'JPG, PNG, or WebP only' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Max file size is 3 MB' }, { status: 400 });
  void MAX_PER_REQUEST;

  const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const ext = extMap[file.type] ?? 'jpg';
  const filename = `reviews/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const res = await uploadMedia(filename, await file.arrayBuffer(), file.type);
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ url: res.url });
}
