/**
 * SEO snapshot for the Cloudflare migration (plan rule 8): one JSON per run in
 * docs/seo/ with the numbers that must not move when hosting does, and the
 * alarms that mean "roll back" when compared with the previous snapshot.
 *
 *   npx tsx scripts/seo-snapshot.ts                       # write docs/seo/snapshot-<today>.json
 *   npx tsx scripts/seo-snapshot.ts --compare docs/seo/snapshot-2026-09-19.json
 *   npx tsx scripts/seo-snapshot.ts --semrush docs/seo/semrush-organic-pk-2026-09-19.csv
 *
 * Reads the store's own Search Console feed (seo_daily_metrics, written by the
 * analytics-refresh cron), the field Core Web Vitals RPC, the GSC index-status
 * table and the twice-monthly rank tracker. Semrush has no API key in this
 * repo; export its organic report from the Semrush session and pass the CSV.
 *
 * Alarms (any one is a rollback trigger after a cutover):
 *   - 7-day GSC clicks down more than 20% against the previous snapshot
 *   - p75 TTFB or LCP worse than the previous snapshot by more than 15%
 *   - a Semrush top-30 URL down more than 5 positions on its best keyword
 *   - indexed URL count down by more than 2%
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type Snapshot = {
  date: string;
  gsc: { days: number; clicks: number; impressions: number; avgPosition: number | null };
  vitals7: Record<string, { p75: number; samples: number }>;
  index: Record<string, number>;
  rank: { lastRun: string | null; keywords: number; top10: number; top30: number };
  semrush?: { keywords: number; traffic: number; byUrl: Record<string, { best: number; traffic: number }> };
};

function arg(name: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

async function build(): Promise<Snapshot> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local)');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const date = new Date().toISOString().slice(0, 10);

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const { data: gsc } = await sb.from('seo_daily_metrics').select('day, gsc_clicks, gsc_impressions, gsc_position').gte('day', since).not('gsc_clicks', 'is', null);
  const rows = gsc ?? [];
  const clicks = rows.reduce((s, r) => s + (r.gsc_clicks ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.gsc_impressions ?? 0), 0);
  const pos = rows.filter(r => r.gsc_position != null);
  const avgPosition = pos.length ? Number((pos.reduce((s, r) => s + Number(r.gsc_position), 0) / pos.length).toFixed(1)) : null;

  const { data: v } = await sb.rpc('web_vitals_summary', { p_days: 7 });
  const vitals7: Snapshot['vitals7'] = {};
  for (const m of (v ?? []) as Array<{ metric: string; p75: number; samples: number }>) vitals7[m.metric] = { p75: Number(m.p75), samples: Number(m.samples) };

  const { data: idx } = await sb.from('gsc_url_index_status').select('coverage_state');
  const index: Record<string, number> = {};
  for (const r of idx ?? []) index[r.coverage_state ?? 'unknown'] = (index[r.coverage_state ?? 'unknown'] ?? 0) + 1;

  const { data: last } = await sb.from('seo_ranking_snapshots').select('checked_at').order('checked_at', { ascending: false }).limit(1);
  const lastRun = last?.[0]?.checked_at ?? null;
  let rank: Snapshot['rank'] = { lastRun, keywords: 0, top10: 0, top30: 0 };
  if (lastRun) {
    const { data: rs } = await sb.from('seo_ranking_snapshots').select('position').eq('checked_at', lastRun);
    const ps = (rs ?? []).map(r => Number(r.position)).filter(n => n > 0);
    rank = { lastRun, keywords: ps.length, top10: ps.filter(p => p <= 10).length, top30: ps.filter(p => p <= 30).length };
  }

  const snap: Snapshot = { date, gsc: { days: rows.length, clicks, impressions, avgPosition }, vitals7, index, rank };
  const csv = arg('semrush');
  if (csv) {
    const lines = fs.readFileSync(csv, 'utf8').trim().split(/\r?\n/).slice(1);
    const byUrl: Record<string, { best: number; traffic: number }> = {};
    let traffic = 0;
    for (const l of lines) {
      const [, position, , u, t] = l.split(';');
      const p = Number(position); const tr = Number(t) || 0; traffic += tr;
      const k = new URL(u).pathname;
      byUrl[k] = { best: Math.min(byUrl[k]?.best ?? 999, p), traffic: (byUrl[k]?.traffic ?? 0) + tr };
    }
    snap.semrush = { keywords: lines.length, traffic, byUrl };
  }
  return snap;
}

function compare(prev: Snapshot, cur: Snapshot): string[] {
  const alarms: string[] = [];
  if (prev.gsc.clicks > 0 && cur.gsc.clicks < prev.gsc.clicks * 0.8) alarms.push(`GSC 7-day clicks ${prev.gsc.clicks} -> ${cur.gsc.clicks}`);
  for (const m of ['TTFB', 'LCP']) {
    const a = prev.vitals7[m]?.p75, b = cur.vitals7[m]?.p75;
    if (a && b && b > a * 1.15) alarms.push(`${m} p75 ${a} -> ${b}`);
  }
  const indexed = (s: Snapshot) => s.index['Submitted and indexed'] ?? 0;
  if (indexed(prev) > 0 && indexed(cur) < indexed(prev) * 0.98) alarms.push(`indexed URLs ${indexed(prev)} -> ${indexed(cur)}`);
  if (prev.semrush && cur.semrush) {
    for (const [u, p] of Object.entries(prev.semrush.byUrl)) {
      if (p.best > 30) continue;
      const c = cur.semrush.byUrl[u];
      if (!c) alarms.push(`Semrush: ${u} no longer ranks (was ${p.best})`);
      else if (c.best > p.best + 5) alarms.push(`Semrush: ${u} best position ${p.best} -> ${c.best}`);
    }
  }
  return alarms;
}

async function main() {
  const cur = await build();
  const out = path.join('docs', 'seo', `snapshot-${cur.date}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(cur, null, 1));
  console.log(`wrote ${out}`);
  console.log(JSON.stringify({ gsc: cur.gsc, vitals7: cur.vitals7, index: cur.index, rank: cur.rank, semrush: cur.semrush && { keywords: cur.semrush.keywords, traffic: cur.semrush.traffic } }, null, 1));
  const prevFile = arg('compare');
  if (prevFile) {
    const alarms = compare(JSON.parse(fs.readFileSync(prevFile, 'utf8')), cur);
    if (alarms.length) { console.log('ALARMS:\n  ' + alarms.join('\n  ')); process.exit(1); }
    console.log('no alarms against ' + prevFile);
  }
}

main().catch(e => { console.error(e); process.exit(2); });
