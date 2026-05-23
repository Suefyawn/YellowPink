export const dynamic = 'force-dynamic';

import { SettingsPageHeader } from '@/components/admin/settings-controls';

// Stub page — the multi-recipient notifications config (per-event opt-in)
// lands in the next PR. Today the single recipient still comes from the
// OWNER_EMAIL env var (src/lib/email.ts), so document that here so the
// owner knows where to look until the UI exists.

export default function SettingsNotificationsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Notifications"
        subtitle="Who receives the internal alerts the system sends — new orders, low stock, payment failures."
      />

      <div style={{
        background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        padding: '32px 28px', display: 'grid', gap: 16,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
          padding: '4px 10px', borderRadius: 999,
          background: '#fef3c7', color: '#92400e',
          fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Coming next
        </div>

        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
          Multi-recipient notifications
        </h2>

        <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
          A per-event recipient list lands in the next update. You&apos;ll be
          able to add as many staff email addresses as you like and pick which
          alerts each one receives — new orders, low stock, payment failures,
          and Sentry/PostHog admin alerts.
        </p>

        <div style={{
          background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '16px 18px', fontSize: '0.8125rem', color: '#374151', lineHeight: 1.6,
        }}>
          <strong style={{ color: '#111827' }}>Until then:</strong> notifications go to
          a single address controlled by the <code style={{ background: '#e5e7eb', padding: '1px 6px', borderRadius: 4 }}>OWNER_EMAIL</code> environment
          variable. To change it, open the project on Vercel → <em>Project Settings</em> → <em>Environment Variables</em>,
          edit <code style={{ background: '#e5e7eb', padding: '1px 6px', borderRadius: 4 }}>OWNER_EMAIL</code> for the
          Production environment, then redeploy.
        </div>
      </div>
    </>
  );
}
