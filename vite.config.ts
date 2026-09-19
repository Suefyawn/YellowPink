import { defineConfig, type Plugin } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';
import path from 'node:path';
import { responseStoreAdapter } from '@vinext/cloudflare/cache/response-store-adapter';

const lib = (file: string) => path.resolve(import.meta.dirname, 'src/lib', file);

/**
 * Runtime-specific code lives in one module pair (src/lib/platform.ts and
 * platform.workerd.ts); the Workers build gets the workerd version. A `pre`
 * plugin because vinext resolves `@/` paths before `resolve.alias` runs
 * (same trick as Searchable, ADR-41).
 */
const workersOnly: Plugin = {
  name: 'yellowpink:workers-only',
  enforce: 'pre',
  resolveId(source) {
    if (/^(@\/lib\/platform|.*[\\/]src[\\/]lib[\\/]platform(\.ts)?)$/.test(source)) return lib('platform.workerd.ts');
    return null;
  },
};

export default defineConfig({
  plugins: [
    workersOnly,
    vinext({
      // Rendered pages live in R2 with a SQLite Durable Object index: one copy
      // worldwide per revalidation window (wrangler.jsonc `exports`).
      cache: responseStoreAdapter({ mode: 'self-contained' }),
    }),
    cloudflare({
      // `vinext dev` runs on a config without the Response Store Durable Object, which the dev server cannot host.
      configPath: process.argv.includes('dev') ? 'wrangler.dev.jsonc' : undefined,
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
});
