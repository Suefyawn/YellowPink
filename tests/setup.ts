// Vitest global setup. Add stubs / env hooks here.
process.env.STAFF_SESSION_SECRET ??= 'test-secret';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon';
