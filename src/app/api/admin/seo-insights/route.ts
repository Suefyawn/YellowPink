// ============================================================================
// Read-only SEO/analytics dump: pulls Search Console + GA4 for the connected
// account so the owner (or a maintenance task) can review search performance
// and find optimisation opportunities. Guarded by CRON_SECRET.
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<site>/api/admin/seo-insights?days=28"
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleConnection, gscQuery, ga4RunReport } from '@/lib/google';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

function isoDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const conn = await getGoogleConnection();
  if (!conn) return NextResponse.json({ error: 'google_not_connected' }, { status: 400 });

  const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days') ?? 28)));
  // GSC data lags ~2-3 days; end the window a few days back so it isn't sparse.
  const endDate = isoDaysAgo(3);
  const startDate = isoDaysAgo(3 + days);

  const out: Record<string, unknown> = {
    window: { startDate, endDate, days },
    gsc_site: conn.gsc_site_url,
    ga4_property: conn.ga4_property_id,
    ga4_property_name: conn.ga4_property_name,
  };
  const errors: Record<string, string> = {};

  // ── Search Console ─────────────────────────────────────────────────────────
  if (conn.gsc_site_url) {
    const site = conn.gsc_site_url;
    try {
      out.gsc_queries = await gscQuery({ siteUrl: site, startDate, endDate, dimensions: ['query'], rowLimit: 200 });
    } catch (e) { errors.gsc_queries = (e as Error).message; }
    try {
      out.gsc_pages = await gscQuery({ siteUrl: site, startDate, endDate, dimensions: ['page'], rowLimit: 200 });
    } catch (e) { errors.gsc_pages = (e as Error).message; }
    try {
      out.gsc_query_page = await gscQuery({ siteUrl: site, startDate, endDate, dimensions: ['query', 'page'], rowLimit: 500 });
    } catch (e) { errors.gsc_query_page = (e as Error).message; }
    try {
      const totals = await gscQuery({ siteUrl: site, startDate, endDate, dimensions: [], rowLimit: 1 });
      out.gsc_totals = totals[0] ?? null;
    } catch (e) { errors.gsc_totals = (e as Error).message; }
  } else {
    errors.gsc = 'no gsc_site_url set';
  }

  // ── GA4 ────────────────────────────────────────────────────────────────────
  if (conn.ga4_property_id) {
    const pid = conn.ga4_property_id;
    try {
      out.ga4_totals = (await ga4RunReport({
        propertyId: pid, startDate, endDate,
        metrics: ['sessions', 'totalUsers', 'screenPageViews', 'transactions', 'purchaseRevenue', 'engagementRate'],
      }))[0] ?? null;
    } catch (e) { errors.ga4_totals = (e as Error).message; }
    try {
      out.ga4_landing_pages = await ga4RunReport({
        propertyId: pid, startDate, endDate,
        dimensions: ['landingPagePlusQueryString'],
        metrics: ['sessions', 'screenPageViews', 'transactions', 'purchaseRevenue', 'engagementRate'],
        limit: 100,
      });
    } catch (e) { errors.ga4_landing_pages = (e as Error).message; }
    try {
      out.ga4_channels = await ga4RunReport({
        propertyId: pid, startDate, endDate,
        dimensions: ['sessionDefaultChannelGroup'],
        metrics: ['sessions', 'totalUsers', 'transactions', 'purchaseRevenue'],
        limit: 30,
      });
    } catch (e) { errors.ga4_channels = (e as Error).message; }
    try {
      out.ga4_top_pages = await ga4RunReport({
        propertyId: pid, startDate, endDate,
        dimensions: ['pagePath'],
        metrics: ['screenPageViews', 'sessions', 'transactions'],
        limit: 100,
      });
    } catch (e) { errors.ga4_top_pages = (e as Error).message; }
  } else {
    errors.ga4 = 'no ga4_property_id set';
  }

  if (Object.keys(errors).length) out.errors = errors;
  return NextResponse.json(out);
}

// redeploy nudge: force prod build for seo-insights route
