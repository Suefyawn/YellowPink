import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from './src/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  // Redact customer emails / phone numbers before events leave the server.
  beforeSend: (event) => scrubEvent(event),
});
