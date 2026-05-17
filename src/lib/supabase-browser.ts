import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | null = null;

export function getBrowserClient() {
  if (!client) {
    // Demo-mode fallback so the client doesn't throw on import when env vars
    // are unset (matches the server-side fallback in lib/supabase.ts).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.invalid';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';
    client = createClient(url, key);
  }
  return client;
}
