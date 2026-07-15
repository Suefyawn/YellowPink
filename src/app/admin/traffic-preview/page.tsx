// TEMPORARY dev-only preview harness for TrafficSearchDashboard — synthetic
// data, no auth, deleted before commit. Never ship this file.
import { notFound } from 'next/navigation';
import { TrafficSearchDashboard } from '@/components/admin/insights/TrafficSearchDashboard';
import type { TrafficSearchData, ChannelDay, GscDay } from '@/lib/traffic-insights';

export const dynamic = 'force-dynamic';

function synth(): TrafficSearchData {
  const days = 180;
  const channelDaily: ChannelDay[] = [];
  const gscDaily: GscDay[] = [];
  for (let i = days; i > 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const t = (days - i) / days; // 0..1 growth factor
    const wobble = (seed: number) => 0.6 + 0.8 * Math.abs(Math.sin(i * seed));
    channelDaily.push({
      date: d,
      sessions: {
        'Organic Search': Math.round((2 + 26 * t) * wobble(0.7)),
        'Direct': Math.round((8 + 10 * t) * wobble(1.3)),
        'Referral': Math.round(2 * wobble(2.1)),
        'Organic Social': Math.round((1 + 4 * t) * wobble(0.4)),
        'Email': i % 9 === 0 ? 2 : 0,
      },
    });
    const impressions = Math.round((20 + 220 * t) * wobble(0.9));
    const clicks = Math.round(impressions * 0.03 * wobble(1.7));
    gscDaily.push({ date: d, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: 34 - 18 * t + 4 * Math.sin(i * 0.5) });
  }
  const q = (k: string, c: number, im: number, pos: number) => ({ keys: [k], clicks: c, impressions: im, ctr: im ? c / im : 0, position: pos });
  return {
    connected: true,
    channelDaily,
    gscDaily,
    topQueries: [
      q('folic acid tablet', 42, 1900, 8.2), q('niacinamide serum', 31, 1400, 9.7),
      q('cranberry sachet uses', 22, 410, 4.1), q('myofolic sachet', 15, 380, 6.9),
      q('kojic acid in pakistan', 11, 350, 11.2), q('bawaseer in english', 9, 800, 14.0),
      q('surbex z alternative', 7, 160, 5.5), q('uric acid symptoms', 5, 900, 18.3),
    ],
    topPages: [
      q('https://www.yellowpink.pk/blog/folic-acid-tablets-benefits-dosage-pakistan', 44, 2100, 8.4),
      q('https://www.yellowpink.pk/blog/niacinamide-serum-guide-how-to-use-pakistan', 30, 1350, 9.9),
      q('https://www.yellowpink.pk/', 21, 600, 12.1),
      q('https://www.yellowpink.pk/blog/cranberry-sachet-uses-price-pakistan', 19, 400, 4.3),
      q('https://www.yellowpink.pk/brand/christine', 8, 300, 15.8),
    ],
    indexing: [
      { state: 'Discovered - currently not indexed', count: 92 },
      { state: 'Submitted and indexed', count: 29 },
      { state: 'URL is unknown to Google', count: 19 },
      { state: 'Not checked yet', count: 5 },
      { state: 'Crawled - currently not indexed', count: 1 },
    ],
  };
}

export default function Preview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: 24, background: '#f3f4f6' }}>
      <TrafficSearchDashboard data={synth()} />
    </div>
  );
}
