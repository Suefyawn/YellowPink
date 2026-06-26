export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import {
  inp, lbl, Section, Card, Divider, SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';
import { readAnalyticsCache, timeAgoShort } from '@/lib/analytics-cache';
import { getGoogleConnection, isGoogleOAuthConfigured, REDIRECT_URI, listSitemaps, listGscSites, listGa4Properties, type SitemapStatus, type GscSite, type Ga4Property } from '@/lib/google';
import { disconnectGoogleAction, submitSitemapAction, setGscSiteAction, setGa4PropertyAction } from './google-actions';
import { UrlIndexChecker } from '@/components/admin/UrlIndexChecker';

// IMPORTANT: never render an env-var VALUE on this page, only its presence.
// All checks happen server-side; only the boolean leaves this module.

interface IntegrationCheck {
  name: string;
  /** Short purpose so the owner knows what this integration does. */
  purpose: string;
  /** Env vars required for the integration to work. Missing any one =
   *  the integration is considered "Not configured". */
  envVars: string[];
  /** Env vars that are nice-to-have but not required, missing ones don't
   *  affect the status badge. Used for fallback knobs that an upstream
   *  service can already satisfy without the env var (e.g. a redundant SEO
   *  verification meta tag when DNS verification is already done). */
  optionalEnvVars?: string[];
  /** Optional analytics_cache key whose updated_at lets us show a freshness
   *  badge ("Last synced 12m ago"). */
  cacheKey?: string;
  /** Doc-ref shown when the integration is missing, points the owner at the
   *  setup instructions (file path or USER-MANUAL section). */
  setupRef: string;
}

const INTEGRATIONS: IntegrationCheck[] = [
  {
    name: 'Resend (transactional email)',
    purpose: 'Order confirmations, shipping updates, password resets, newsletter sends. The webhook secret unlocks delivery/open/click tracking on the Email log.',
    envVars: ['RESEND_API_KEY', 'EMAIL_FROM', 'RESEND_WEBHOOK_SECRET'],
    setupRef: 'src/lib/email.ts',
  },
  {
    name: 'PostHog analytics',
    purpose: 'Pageviews, sessions, funnel, top pages, top referrers, the traffic widgets on Analytics.',
    envVars: ['POSTHOG_PERSONAL_API_KEY'],
    cacheKey: 'posthog',
    setupRef: 'src/app/admin/dashboard/actions.ts',
  },
  {
    name: 'Sentry error tracking',
    purpose: 'Captures runtime errors and surfaces them on the Analytics page.',
    envVars: ['SENTRY_DSN', 'SENTRY_AUTH_TOKEN'],
    cacheKey: 'sentry',
    setupRef: 'src/lib/sentry.ts',
  },
  {
    name: 'Upstash Redis (rate-limiting)',
    purpose: 'Backs the per-IP rate limit on the contact form, login, and password reset.',
    envVars: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    setupRef: 'src/lib/rate-limit.ts',
  },
  {
    name: 'JazzCash payments',
    purpose: 'Mobile-wallet + card checkout via JazzCash. Skip if you only take COD/bank.',
    envVars: ['JAZZCASH_MERCHANT_ID', 'JAZZCASH_PASSWORD', 'JAZZCASH_INTEGRITY_SALT'],
    setupRef: 'src/lib/payments/jazzcash.ts',
  },
  {
    name: 'Easypaisa payments',
    purpose: 'Easypaisa wallet checkout. Skip if you only take COD/bank.',
    envVars: ['EASYPAISA_STORE_ID', 'EASYPAISA_HASH_KEY'],
    setupRef: 'src/lib/payments/easypaisa.ts',
  },
  {
    name: 'Google Search Console',
    purpose: 'Backup HTML meta-tag verification. Only needed for URL-prefix properties; Domain properties verify via DNS and don\'t need this.',
    envVars: [],
    optionalEnvVars: ['GOOGLE_SITE_VERIFICATION'],
    setupRef: 'docs/USER-MANUAL.md §7',
  },
  {
    name: 'WhatsApp business',
    purpose: 'The footer button + per-order WhatsApp link to message the customer about their order.',
    envVars: ['NEXT_PUBLIC_WHATSAPP_NUMBER'],
    setupRef: 'docs/USER-MANUAL.md §3',
  },
  {
    name: 'Meta Pixel (Instagram/Facebook ads)',
    purpose: 'Loads the Meta Pixel (marketing-consent gated) and tracks ViewContent/AddToCart/InitiateCheckout/Purchase so Instagram & Facebook ads can optimise and measure conversions.',
    envVars: ['NEXT_PUBLIC_META_PIXEL_ID'],
    setupRef: 'docs/USER-MANUAL.md §7',
  },
];

interface RenderedVar { name: string; present: boolean; optional: boolean }

interface ResolvedIntegration extends IntegrationCheck {
  status: 'ok' | 'partial' | 'missing';
  /** Only the missing *required* vars, drives the status badge. */
  missingVars: string[];
  /** Required + optional vars merged into render-ready rows. */
  renderedVars: RenderedVar[];
  lastSync: string | null;
}

async function resolve(integration: IntegrationCheck): Promise<ResolvedIntegration> {
  const missingVars = integration.envVars.filter(v => !process.env[v]);
  // An integration with no required vars (e.g. one whose only knob is an
  // optional fallback) is considered "ok", there's nothing to configure for
  // it to do its job.
  const status: 'ok' | 'partial' | 'missing' =
    integration.envVars.length === 0 || missingVars.length === 0 ? 'ok' :
    missingVars.length < integration.envVars.length ? 'partial' :
    'missing';

  const renderedVars: RenderedVar[] = [
    ...integration.envVars.map(name => ({ name, present: Boolean(process.env[name]), optional: false })),
    ...(integration.optionalEnvVars ?? []).map(name => ({ name, present: Boolean(process.env[name]), optional: true })),
  ];

  let lastSync: string | null = null;
  if (integration.cacheKey && status !== 'missing') {
    const cached = await readAnalyticsCache<unknown>(integration.cacheKey);
    if (cached) lastSync = cached.updatedAt;
  }

  return { ...integration, status, missingVars, renderedVars, lastSync };
}

function StatusBadge({ status }: { status: 'ok' | 'partial' | 'missing' }) {
  const map = {
    ok:      { bg: '#f0fdf4', fg: '#15803d', label: 'Configured' },
    partial: { bg: '#fef3c7', fg: '#92400e', label: 'Partial' },
    missing: { bg: '#f3f4f6', fg: '#6b7280', label: 'Not configured' },
  } as const;
  const v = map[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 10px', borderRadius: 999,
      background: v.bg, color: v.fg,
      fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {v.label}
    </span>
  );
}

export default async function SettingsIntegrationsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; google?: string }> }) {
  const [resolved, s, sp, googleConn] = await Promise.all([
    Promise.all(INTEGRATIONS.map(resolve)),
    getSiteSettings(),
    searchParams,
    getGoogleConnection(),
  ]);
  const g = (key: string) => s[key] ?? '';
  const googleConfigured = isGoogleOAuthConfigured();

  // When connected, fetch the owner's GSC sites + GA4 properties so they can
  // pick the right one from a dropdown (auto-link only guesses). All best-effort
  //, a Google API hiccup must never break the settings page.
  let gscSites: GscSite[] = [];
  let ga4Props: Ga4Property[] = [];
  let sitemaps: SitemapStatus[] = [];
  if (googleConn) {
    const [sitesR, propsR] = await Promise.allSettled([listGscSites(), listGa4Properties()]);
    if (sitesR.status === 'fulfilled') gscSites = sitesR.value;
    if (propsR.status === 'fulfilled') ga4Props = propsR.value;
    if (googleConn.gsc_site_url) {
      try { sitemaps = await listSitemaps(googleConn.gsc_site_url); } catch { /* show none */ }
    }
  }
  const ourSitemap = sitemaps.find(m => m.path.includes('/sitemap.xml')) ?? sitemaps[0] ?? null;
  const googleMsg: Record<string, string> = {
    connected: '✓ Google account connected.',
    disconnected: 'Google account disconnected.',
    sitemap_submitted: '✓ Sitemap submitted to Google for crawling.',
    saved: '✓ Saved.',
  };

  const summary = {
    ok:      resolved.filter(r => r.status === 'ok').length,
    partial: resolved.filter(r => r.status === 'partial').length,
    missing: resolved.filter(r => r.status === 'missing').length,
  };

  return (
    <>
      <SettingsPageHeader
        title="Integrations"
        subtitle="Connect Google Analytics & Search Console below, then check the live status of every third-party service."
      />

      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      {/* Connect Google, owner-editable, no redeploy needed (saved to
          site_settings, read by the root layout). */}
      <Card>
        <form action={saveSettings}>
          <input type="hidden" name="_redirect" value="/admin/settings/integrations" />
          <Section title="Connect Google" desc="Paste your IDs to link Google Analytics 4 and Search Console directly, changes go live immediately, no redeploy." />
          <Divider />
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Google Analytics 4, Measurement ID</label>
              <input name="ga_measurement_id" defaultValue={g('ga_measurement_id')} style={inp} placeholder="G-XXXXXXXXXX" />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
                GA4 → Admin → Data streams → your web stream → <em>Measurement ID</em>.
              </p>
            </div>
            <div>
              <label style={lbl}>Search Console, verification code</label>
              <input name="google_site_verification" defaultValue={g('google_site_verification')} style={inp} placeholder="paste only the content=… value" />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
                Search Console → add a URL-prefix property → <em>HTML tag</em> method → paste only the <code>content</code> value, then click Verify.
              </p>
            </div>
            <div>
              <label style={lbl}>Meta (Facebook/Instagram), domain verification code</label>
              <input name="facebook_domain_verification" defaultValue={g('facebook_domain_verification')} style={inp} placeholder="paste only the content=… value" />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
                Business Manager → Brand safety → <em>Domains</em> → add your domain → <em>Meta-tag verification</em> → paste only the <code>content</code> value, then click Verify. Required before running conversion ads.
              </p>
            </div>
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #f3f4f6', paddingTop: 16, marginTop: 4 }}>
              <label style={lbl}>Medical reviewers (E-E-A-T), for health/supplement content</label>
              <p style={{ margin: '0 0 2px', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
                Managed on the <Link href="/admin/reviewers" style={{ color: '#9d174d', fontWeight: 600 }}>Medical Review Board</Link>, add real, credentialed doctors there (or let them apply), set a <strong>default</strong>, and assign reviewers per health post. Their <strong>&ldquo;Medically reviewed by&rdquo;</strong> byline + schema is the strongest trust signal Google looks for on supplement/health content.
              </p>
            </div>
          </div>
          <SaveBar />
        </form>
      </Card>

      {/* Connect Google (OAuth), live GSC/GA4 + sitemap submission. */}
      {sp.google && googleMsg[sp.google] && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#166534', fontSize: '0.875rem' }}>
          {googleMsg[sp.google]}
        </div>
      )}
      <Card>
        <Section
          title="Connect Google, live data &amp; indexing"
          desc="Sign in with Google to pull live Search Console &amp; GA4 data into your dashboard and submit your sitemap for indexing, no CSV uploads."
        />
        <Divider />

        {!googleConfigured ? (
          <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 10px' }}>To enable this, set up a Google Cloud OAuth app (one-time):</p>
            <ol style={{ margin: '0 0 12px', paddingLeft: 20, display: 'grid', gap: 4 }}>
              <li>In <strong>console.cloud.google.com</strong>, enable the <em>Search Console API</em>, <em>Analytics Data API</em> and <em>Analytics Admin API</em>.</li>
              <li>OAuth consent screen → <strong>External</strong>, add your Google email as a <strong>Test user</strong>.</li>
              <li>Create an <strong>OAuth client (Web)</strong> with this exact redirect URI:</li>
            </ol>
            <code style={{ display: 'block', padding: '8px 12px', background: '#f3f4f6', borderRadius: 6, fontSize: '0.8125rem', wordBreak: 'break-all', marginBottom: 12 }}>{REDIRECT_URI}</code>
            <p style={{ margin: 0, color: '#6b7280' }}>Then set <code>GOOGLE_OAUTH_CLIENT_ID</code> and <code>GOOGLE_OAUTH_CLIENT_SECRET</code> in Vercel and redeploy, a <strong>Connect</strong> button appears here.</p>
          </div>
        ) : !googleConn ? (
          <div>
            <a href="/api/google/oauth/start" className="adm-btn-primary" style={{ display: 'inline-block', padding: '10px 20px', background: '#111827', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
              Connect Google account
            </a>
            <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
              Grants read access to Search Console &amp; GA4 and lets us submit your sitemap. Redirect URI registered in Cloud Console must be <code style={{ wordBreak: 'break-all' }}>{REDIRECT_URI}</code>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: '0.875rem', color: '#111827' }}>
                Connected as <strong>{googleConn.email ?? 'your Google account'}</strong>
              </div>
              <form action={disconnectGoogleAction}>
                <button type="submit" style={{ padding: '6px 12px', fontSize: '0.8125rem', background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#6b7280' }}>Disconnect</button>
              </form>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="adm-form-2col">
              <form action={setGscSiteAction}>
                <label style={lbl}>Search Console property</label>
                {gscSites.length > 0 ? (
                  <select name="gsc_site_url" defaultValue={googleConn.gsc_site_url ?? ''} style={inp}>
                    {!googleConn.gsc_site_url && <option value="">Select a property…</option>}
                    {gscSites.map(s => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                  </select>
                ) : (
                  <input name="gsc_site_url" defaultValue={googleConn.gsc_site_url ?? ''} style={inp} placeholder="sc-domain:yellowpink.pk" />
                )}
                <button type="submit" style={{ marginTop: 8, padding: '6px 12px', fontSize: '0.8125rem', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer' }}>Save</button>
              </form>
              <form action={setGa4PropertyAction}>
                <label style={lbl}>GA4 property</label>
                {ga4Props.length > 0 ? (
                  <select name="ga4_property_id" defaultValue={ga4Props.find(p => p.propertyId === googleConn.ga4_property_id) ? `${googleConn.ga4_property_id}::${googleConn.ga4_property_name ?? ''}` : ''} style={inp}>
                    {!googleConn.ga4_property_id && <option value="">Select a property…</option>}
                    {ga4Props.map(p => <option key={p.propertyId} value={`${p.propertyId}::${p.displayName}`}>{p.displayName} ({p.propertyId})</option>)}
                  </select>
                ) : (
                  <input name="ga4_property_id" defaultValue={googleConn.ga4_property_id ?? ''} style={inp} placeholder="e.g. 412345678" />
                )}
                <button type="submit" style={{ marginTop: 8, padding: '6px 12px', fontSize: '0.8125rem', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer' }}>Save</button>
              </form>
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
              <label style={lbl}>Submit pages for indexing</label>
              <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
                Submits your full sitemap to Google so it (re)crawls every page. Google still decides what/when to index, there is no API to force-index individual pages, so the sitemap is the supported, scalable nudge.
              </p>
              <form action={submitSitemapAction}>
                <button type="submit" disabled={!googleConn.gsc_site_url} className="adm-btn-primary" style={{ padding: '8px 16px', background: googleConn.gsc_site_url ? '#111827' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, cursor: googleConn.gsc_site_url ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.8125rem' }}>
                  Submit sitemap to Google
                </button>
              </form>
              {ourSitemap && (
                <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Last submitted: {ourSitemap.lastSubmitted ? new Date(ourSitemap.lastSubmitted).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  {' · '}{ourSitemap.submittedUrls} URLs
                  {ourSitemap.errors > 0 && <span style={{ color: '#dc2626' }}> · {ourSitemap.errors} errors</span>}
                </p>
              )}
            </div>

            <UrlIndexChecker />
          </div>
        )}
      </Card>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{
          flex: '1 1 140px', minWidth: 140,
          background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '14px 18px',
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#15803d' }}>{summary.ok}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Configured</div>
        </div>
        <div style={{
          flex: '1 1 140px', minWidth: 140,
          background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '14px 18px',
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#92400e' }}>{summary.partial}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Partial</div>
        </div>
        <div style={{
          flex: '1 1 140px', minWidth: 140,
          background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '14px 18px',
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6b7280' }}>{summary.missing}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Not configured</div>
        </div>
      </div>

      {/* Per-integration cards */}
      <div style={{ display: 'grid', gap: 12 }}>
        {resolved.map(i => (
          <div key={i.name} style={{
            background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{i.name}</h3>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.5 }}>{i.purpose}</p>
              </div>
              <StatusBadge status={i.status} />
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8,
              marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6',
              fontSize: '0.75rem',
            }}>
              <div>
                <div style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Env vars</div>
                <div style={{ color: '#374151', lineHeight: 1.6 }}>
                  {i.renderedVars.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>None required</div>
                  ) : i.renderedVars.map(v => {
                    // Missing-but-optional gets a muted tick mark, not a red ✗,                     // it's a knob, not a gap.
                    const colour = v.present ? '#15803d' : (v.optional ? '#9ca3af' : '#dc2626');
                    return (
                      <div key={v.name} style={{ fontFamily: 'monospace' }}>
                        <span style={{ color: colour }}>{v.present ? '✓' : '✗'}</span> {v.name}
                        {v.optional && (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic', fontFamily: 'inherit' }}> (optional)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {i.cacheKey && (
                <div>
                  <div style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Last sync</div>
                  <div style={{ color: '#374151' }}>
                    {i.lastSync ? timeAgoShort(i.lastSync) : '—'}
                  </div>
                </div>
              )}

              <div>
                <div style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Setup ref</div>
                <div style={{ color: '#374151', fontFamily: 'monospace', fontSize: '0.6875rem', wordBreak: 'break-all' }}>
                  {i.setupRef}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ margin: '20px 0 0', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
        To configure a missing integration, open Vercel → <em>Project Settings</em> → <em>Environment Variables</em>,
        add the env vars under <em>Production</em>, then redeploy. This page never shows the secret values themselves.
      </p>
    </>
  );
}
