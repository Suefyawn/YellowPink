export const dynamic = 'force-dynamic';

import { SettingsPageHeader } from '@/components/admin/settings-controls';

// Stub page — the live status panel (GA4 / Sentry / Resend / PostHog
// connection state, last refresh, quotas) lands in a follow-up. For now
// integrations are configured via env vars; document that here so the
// owner knows where to look.

const INTEGRATIONS = [
  { name: 'Google Analytics 4',  envHint: 'GA4_PROPERTY_ID + service-account JSON',                  docs: 'docs/USER-MANUAL.md §7' },
  { name: 'Google Search Console', envHint: 'GSC_SITE_URL + the same service-account JSON',          docs: 'docs/USER-MANUAL.md §7' },
  { name: 'Google Merchant Center', envHint: 'No env required — feed is auto-served at /feeds/google-merchant.xml', docs: 'docs/USER-MANUAL.md §7' },
  { name: 'PostHog',             envHint: 'POSTHOG_API_KEY + POSTHOG_PROJECT_ID',                    docs: 'src/lib/analytics-cache.ts' },
  { name: 'Sentry',              envHint: 'SENTRY_DSN + SENTRY_AUTH_TOKEN (for error-trend widget)',  docs: 'src/lib/sentry.ts' },
  { name: 'Resend (email)',      envHint: 'RESEND_API_KEY + EMAIL_FROM',                              docs: 'src/lib/email.ts' },
];

export default function SettingsIntegrationsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Integrations"
        subtitle="Third-party services Yellow Pink connects to. Live status indicators are coming soon."
      />

      <div style={{
        background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        padding: '24px 28px',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 10px', borderRadius: 999, marginBottom: 16,
          background: '#fef3c7', color: '#92400e',
          fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Coming next
        </div>

        <p style={{ margin: '0 0 20px', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
          A status panel showing which integrations are wired up and healthy
          (last refresh, API quota used, errors) lands in the next update. For
          now each integration is configured via environment variables in Vercel:
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          {INTEGRATIONS.map(i => (
            <div key={i.name} style={{
              display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12,
              padding: '12px 14px', borderRadius: 8,
              background: '#f9fafb', border: '1px solid #f3f4f6',
              fontSize: '0.8125rem',
            }}>
              <div style={{ fontWeight: 600, color: '#111827' }}>{i.name}</div>
              <div style={{ color: '#374151' }}>
                <div>{i.envHint}</div>
                <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: 4 }}>Setup: {i.docs}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
