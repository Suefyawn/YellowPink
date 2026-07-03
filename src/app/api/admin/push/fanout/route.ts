export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAdminPush } from '@/lib/push';

// Fan-out endpoint for the admin_notifications DB trigger (pg_net posts
// here on every insert). Auth is the shared secret from push_config — this
// route is NOT cookie-gated (the database has no cookies), so the secret
// check is the whole gate. Constant-time compare; wrong/missing secret and
// uninitialised config both 401 without detail.
export async function POST(req: Request) {
  const given = req.headers.get('x-push-secret') ?? '';
  const { data: cfg } = await supabaseAdmin()
    .from('push_config')
    .select('webhook_secret')
    .maybeSingle();
  const expected = (cfg as { webhook_secret?: string } | null)?.webhook_secret ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payload = await req.json().catch(() => null) as
    | { kind?: string; title?: string; body?: string; link?: string }
    | null;
  if (!payload?.title) {
    return NextResponse.json({ ok: false, error: 'title required' }, { status: 400 });
  }

  const result = await sendAdminPush({
    title: payload.title,
    body: payload.body ?? undefined,
    url: payload.link ?? '/admin/dashboard',
    tag: payload.kind ?? 'yp-admin',
  });
  return NextResponse.json({ ok: true, ...result });
}
