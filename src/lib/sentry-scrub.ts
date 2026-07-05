// Shared Sentry beforeSend scrubber. Customer PII (emails, Pakistani phone
// numbers) routinely appears in error messages and breadcrumbs, e.g. Supabase
// errors quoting a row, or fetch breadcrumbs carrying ?email= params. Redact
// the patterns rather than trying to enumerate every field that might carry
// them. Replay-side masking is configured separately in sentry.client.config.
type SentryFrame = { filename?: string };
type SentryEventLike = {
  message?: string;
  exception?: { values?: Array<{ value?: string; stacktrace?: { frames?: SentryFrame[] } }> };
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

// Errors thrown by scripts the *host app* injects into its in-app browser
// WebView — Instagram / Facebook / TikTok on Android — not by our code. Their
// frames use the `app://` scheme and their messages (the Android INP
// performance logger losing its native Java bridge, "Java object is gone") have
// nothing to do with the site and are unactionable. ResizeObserver loop notices
// are a benign browser quirk, never a real fault. Dropping this class keeps
// Sentry's signal clean. Returning null from beforeSend discards the event.
const NOISE_MESSAGE_RE =
  /Java object is gone|navigation_performance_logger|ResizeObserver loop (?:limit exceeded|completed)/i;

export function isThirdPartyNoise(event: SentryEventLike): boolean {
  const messages: string[] = [];
  if (event.message) messages.push(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) messages.push(ex.value);
    // Any frame served from an injected in-app-browser script (app:// scheme)
    // is definitionally not our code.
    for (const f of ex.stacktrace?.frames ?? []) {
      if (typeof f.filename === 'string' && f.filename.startsWith('app://')) return true;
    }
  }
  return messages.some(m => NOISE_MESSAGE_RE.test(m));
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
