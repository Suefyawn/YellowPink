// Importer config. Reads + validates env vars; centralises tunables.

import { config as dotenv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Load .env.local then .env from the repo root, if either exists.
for (const file of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), file);
  if (fs.existsSync(p)) dotenv({ path: p, override: false });
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const CONFIG = {
  wp: {
    siteUrl: required('WP_SITE_URL').replace(/\/$/, ''),
    wcKey:   required('WC_CONSUMER_KEY'),
    wcSecret: required('WC_CONSUMER_SECRET'),
    wpUser:  required('WP_USERNAME'),
    wpAppPw: required('WP_APPLICATION_PASSWORD'),
  },
  sb: {
    url:        required('NEXT_PUBLIC_SUPABASE_URL'),
    serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    bucket:     optional('WP_IMPORT_BUCKET', 'images'),
  },
  dryRun: optional('WP_IMPORT_DRY_RUN', 'false') === 'true',
  skipMedia: optional('WP_IMPORT_SKIP_MEDIA', 'false') === 'true',
  batchSize: Number(optional('WP_IMPORT_BATCH_SIZE', '50')),
} as const;

if (CONFIG.dryRun) {
  console.warn('⚠ DRY RUN — no writes will be performed');
}
