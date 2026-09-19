/**
 * Cloudflare Workers entry (wrangler.jsonc `main`). vinext generates the
 * fetch handler and the Response Store classes; this file only wraps the
 * handler with Sentry so server errors on Workers reach the same project
 * the Vercel deployment reported to. Every other runtime difference lives
 * in src/lib/platform.workerd.ts.
 */
import * as Sentry from '@sentry/cloudflare';
import handler from 'vinext/server/fetch-handler';
import { scrubEvent } from './lib/sentry-scrub';

export * from 'vinext/server/fetch-handler';

type Env = { SENTRY_DSN?: string; CF_VERSION_METADATA?: { id?: string } };
type Handler = { fetch(request: Request, env: Env, ctx: unknown): Promise<Response> | Response };

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    release: env.CF_VERSION_METADATA?.id,
    tracesSampleRate: 0.2,
    // Redact customer emails / phone numbers before events leave the server.
    beforeSend: (event) => scrubEvent(event),
  }),
  handler as unknown as Handler,
);
