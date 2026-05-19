// Vitest global setup. Add stubs / env hooks here.
//
// STAFF_SESSION_SECRET has a hard floor of 16 chars (see session-secret.ts)
// — anything shorter falls back to the dev fallback, which makes the
// SHA-256 legacy-hash test mis-compute and fail.
process.env.STAFF_SESSION_SECRET ??= 'test-secret-at-least-16-chars-long';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon';
