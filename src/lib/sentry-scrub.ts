// Shared Sentry beforeSend scrubber. Customer PII (emails, Pakistani phone
// numbers) routinely appears in error messages and breadcrumbs — e.g. Supabase
// errors quoting a row, or fetch breadcrumbs carrying ?email= params. Redact
// the patterns rather than trying to enumerate every field that might carry
// them. Replay-side masking is configured separately in sentry.client.config.
type SentryEventLike = {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<{ message?: string; data?: Record<string, unknown> }>;
  request?: { url?: string; query_string?: unknown };
};

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
// 03xx-xxxxxxx / +92 3xx xxxxxxx, with optional separators.
const PK_PHONE_RE = /(?:\+?92|0)3\d{2}[\s-]?\d{7}/g;

function scrubString(s: string): string {
  return s.replace(EMAIL_RE, '[email]').replace(PK_PHONE_RE, '[phone]');
}

function scrubValue(v: unknown): unknown {
  if (typeof v === 'string') return scrubString(v);
  return v;
}

export function scrubEvent<T extends SentryEventLike>(event: T): T {
  if (event.message) event.message = scrubString(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubString(ex.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubString(crumb.message);
    if (crumb.data) {
      for (const k of Object.keys(crumb.data)) crumb.data[k] = scrubValue(crumb.data[k]);
    }
  }
  if (event.request?.url) event.request.url = scrubString(event.request.url);
  return event;
}
