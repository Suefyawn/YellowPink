import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  num,
  summarise,
  isClarityConfigured,
  clarityApiToken,
  fetchClarityInsights,
  ClarityApiError,
  type ClarityMetric,
} from './clarity';

// ── The real response, captured live ────────────────────────────────────────
// Every earlier version of these tests invented this fixture from a reading of
// Microsoft's docs, which document `Traffic` and nothing else. The invented
// field names (`distantUserCount`, `PagesPerSessionPercentage`, a
// `rageClickCount` on RageClickCount) were all wrong, so the suite passed
// against the parser's own assumptions and could not possibly catch the bug
// that shipped. This fixture is copied verbatim from the payload the live API
// returned on 15 Sep 2026, stored under `raw` on the snapshot.
//
// Rule for this file: a fixture asserts what the API sends, never what the
// parser hopes for.
const LIVE: ClarityMetric[] = [
  { metricName: 'DeadClickCount', information: [{ subTotal: 5, pagesViews: 4, sessionsCount: 54, sessionsWithMetricPercentage: 7.41, sessionsWithoutMetricPercentage: 92.59 }] },
  { metricName: 'ExcessiveScroll', information: [{ subTotal: 0, pagesViews: 0, sessionsCount: 54, sessionsWithMetricPercentage: 0, sessionsWithoutMetricPercentage: 100 }] },
  { metricName: 'RageClickCount', information: [{ subTotal: 0, pagesViews: 0, sessionsCount: 54, sessionsWithMetricPercentage: 0, sessionsWithoutMetricPercentage: 100 }] },
  { metricName: 'QuickbackClick', information: [{ subTotal: 30, pagesViews: 30, sessionsCount: 54, sessionsWithMetricPercentage: 27.78, sessionsWithoutMetricPercentage: 72.22 }] },
  { metricName: 'ScriptErrorCount', information: [{ subTotal: 0, pagesViews: 0, sessionsCount: 54, sessionsWithMetricPercentage: 0, sessionsWithoutMetricPercentage: 100 }] },
  { metricName: 'ErrorClickCount', information: [{ subTotal: 0, pagesViews: 0, sessionsCount: 54, sessionsWithMetricPercentage: 0, sessionsWithoutMetricPercentage: 100 }] },
  { metricName: 'ScrollDepth', information: [{ averageScrollDepth: 41.75 }] },
  { metricName: 'Traffic', information: [{ distinctUserCount: 48, totalSessionCount: 54, totalBotSessionCount: 1, pagesPerSessionPercentage: 3.3275862068965516 }] },
  { metricName: 'EngagementTime', information: [{ totalTime: 136, activeTime: 75 }] },
  { metricName: 'Device', information: [{ name: 'Mobile', sessionsCount: 48 }, { name: 'PC', sessionsCount: 6 }] },
  { metricName: 'Country', information: [{ name: 'Pakistan', sessionsCount: 53 }, { name: 'Bahrain', sessionsCount: 1 }] },
];

const TRAFFIC: ClarityMetric = LIVE.find(m => m.metricName === 'Traffic')!;

describe('num', () => {
  it('coerces the string counts the API actually returns', () => {
    expect(num('9554')).toBe(9554);
    expect(num(' 42 ')).toBe(42);
  });

  it('passes real numbers through', () => {
    expect(num(1.0931)).toBe(1.0931);
  });

  it('never yields NaN or Infinity, so no metric renders as NaN', () => {
    for (const v of ['', 'abc', null, undefined, {}, [], NaN, Infinity]) {
      expect(num(v)).toBe(0);
    }
  });
});

describe('summarise', () => {
  it('reads every traffic figure off the live payload', () => {
    const s = summarise(LIVE);
    expect(s.sessions).toBe(54);
    expect(s.botSessions).toBe(1);
    expect(s.distinctUsers).toBe(48);
    expect(s.pagesPerSession).toBe(3.33);
  });

  // ── The regression this rewrite exists for ────────────────────────────────
  // Shipped 14 Sep 2026 and wrong against the live API twice over. First it
  // took the first numeric field in each row, which is the session total, so
  // every signal read back as 51 on a day with 51 sessions. The fix for that
  // refused any field it could not name, so every signal read back as a dash.
  // Both were caused by the same thing: nobody had looked at a real response.
  it('reads each frustration count from subTotal, not from the denominator', () => {
    const s = summarise(LIVE);
    expect(s.deadClicks.count).toBe(5);
    expect(s.quickbackClicks.count).toBe(30);
    expect(s.rageClicks.count).toBe(0);
    expect(s.scriptErrors.count).toBe(0);
    expect(s.errorClicks.count).toBe(0);
    expect(s.excessiveScroll.count).toBe(0);

    // The specific wrong answers, named so neither can come back.
    for (const sig of [s.deadClicks, s.quickbackClicks, s.rageClicks, s.scriptErrors]) {
      expect(sig.count).not.toBe(54); // the session count
      expect(sig.count).not.toBeNull(); // the over-correction
    }
  });

  it('carries the share of sessions Clarity reports for each signal', () => {
    const s = summarise(LIVE);
    expect(s.deadClicks.sessionPercent).toBe(7.41);
    expect(s.quickbackClicks.sessionPercent).toBe(27.78);
    expect(s.rageClicks.sessionPercent).toBe(0);
  });

  it('reads scroll depth and engagement time', () => {
    const s = summarise(LIVE);
    expect(s.averageScrollDepth).toBe(41.75);
    expect(s.totalTimeMinutes).toBe(136);
    expect(s.activeTimeMinutes).toBe(75);
  });

  it('orders the device split largest first', () => {
    expect(summarise(LIVE).devices).toEqual([
      { name: 'Mobile', sessions: 48 },
      { name: 'PC', sessions: 6 },
    ]);
  });

  it('coerces the string counts the docs say may arrive', () => {
    const s = summarise([
      { metricName: 'Traffic', information: [{ totalSessionCount: '9554', totalBotSessionCount: '8369', distinctUserCount: '189733', pagesPerSessionPercentage: 1.0931 }] },
      { metricName: 'RageClickCount', information: [{ subTotal: '12' }] },
    ]);
    expect(s.sessions).toBe(9554);
    expect(s.distinctUsers).toBe(189733);
    expect(s.rageClicks.count).toBe(12);
  });

  it('sums counts and averages rates across dimension rows', () => {
    // Requesting a dimension splits every metric into one row per value. The
    // daily call requests none, but reading only the first row would silently
    // undercount if that ever changed.
    const s = summarise([
      { metricName: 'Traffic', information: [
        { totalSessionCount: 100, totalBotSessionCount: 1, distinctUserCount: 90, pagesPerSessionPercentage: 2 },
        { totalSessionCount: 300, totalBotSessionCount: 3, distinctUserCount: 280, pagesPerSessionPercentage: 4 },
      ] },
      { metricName: 'DeadClickCount', information: [{ subTotal: 5 }, { subTotal: 7 }] },
    ]);
    expect(s.sessions).toBe(400);
    expect(s.distinctUsers).toBe(370);
    expect(s.pagesPerSession).toBe(3);
    expect(s.deadClicks.count).toBe(12);
  });

  it('returns null rather than 0 when a metric arrives without its count field', () => {
    // If Microsoft renames subTotal, the card must print a dash. A zero would
    // read as "no rage clicks", which is a claim the data does not support.
    const s = summarise([
      { metricName: 'RageClickCount', information: [{ sessionsCount: 54, pagesViews: 3 }] },
    ]);
    expect(s.rageClicks.count).toBeNull();
    expect(s.rageClicks.sessionPercent).toBeNull();
  });

  it('returns null for a metric with an empty information array', () => {
    expect(summarise([{ metricName: 'RageClickCount', information: [] }]).rageClicks.count).toBeNull();
  });

  it('distinguishes a real zero from "not reported" via metricsSeen', () => {
    const reported = summarise(LIVE);
    expect(reported.rageClicks.count).toBe(0);
    expect(reported.metricsSeen).toContain('RageClickCount');

    const absent = summarise([TRAFFIC]);
    expect(absent.rageClicks.count).toBeNull();
    expect(absent.metricsSeen).not.toContain('RageClickCount');
  });

  it('reports null pages-per-session when Traffic is absent', () => {
    expect(summarise([]).pagesPerSession).toBeNull();
  });

  it('ignores metrics it does not know rather than throwing', () => {
    // The docs warn that additional metrics may appear in the response.
    expect(() => summarise([{ metricName: 'SomethingNewMicrosoftAdded', information: [{ x: 1 }] }])).not.toThrow();
  });

  it('survives a malformed information array', () => {
    const s = summarise([{ metricName: 'Traffic', information: [] }]);
    expect(s.sessions).toBe(0);
    expect(s.pagesPerSession).toBeNull();
    expect(s.devices).toEqual([]);
  });
});

describe('configuration', () => {
  const OLD = process.env.CLARITY_API_TOKEN;
  afterEach(() => {
    if (OLD === undefined) delete process.env.CLARITY_API_TOKEN;
    else process.env.CLARITY_API_TOKEN = OLD;
  });

  it('is unconfigured when the token is absent or blank', () => {
    delete process.env.CLARITY_API_TOKEN;
    expect(isClarityConfigured()).toBe(false);
    process.env.CLARITY_API_TOKEN = '   ';
    expect(isClarityConfigured()).toBe(false);
    expect(clarityApiToken()).toBeNull();
  });

  it('is configured when a token is set, and trims it', () => {
    process.env.CLARITY_API_TOKEN = '  jwt.token.here  ';
    expect(isClarityConfigured()).toBe(true);
    expect(clarityApiToken()).toBe('jwt.token.here');
  });
});

describe('fetchClarityInsights', () => {
  const OLD = process.env.CLARITY_API_TOKEN;
  beforeEach(() => { process.env.CLARITY_API_TOKEN = 'test-token'; });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (OLD === undefined) delete process.env.CLARITY_API_TOKEN;
    else process.env.CLARITY_API_TOKEN = OLD;
  });

  interface FetchInit { headers: Record<string, string> }

  // Records what the code actually passed, so the assertions below read a
  // typed tuple rather than indexing into vi's inferred `never[]` call list.
  function stub(status: number, body: unknown) {
    const calls: Array<[url: string, init: FetchInit]> = [];
    const fn = vi.fn(async (url: string | URL, init: FetchInit) => {
      calls.push([String(url), init]);
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    });
    vi.stubGlobal('fetch', fn);
    return { fn, calls };
  }

  it('clamps numOfDays to the API maximum of 3', async () => {
    const { calls } = stub(200, []);
    await fetchClarityInsights(30);
    expect(calls[0][0]).toContain('numOfDays=3');
  });

  it('clamps numOfDays up to the minimum of 1', async () => {
    const { calls } = stub(200, []);
    await fetchClarityInsights(0);
    expect(calls[0][0]).toContain('numOfDays=1');
  });

  it('sends the bearer token', async () => {
    const { calls } = stub(200, []);
    await fetchClarityInsights(1);
    expect(calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('names the quota explicitly on 429, so no caller retries into it', async () => {
    stub(429, {});
    await expect(fetchClarityInsights(1)).rejects.toThrow(/quota exhausted/i);
  });

  it('throws a typed error carrying the status', async () => {
    stub(401, {});
    await expect(fetchClarityInsights(1)).rejects.toBeInstanceOf(ClarityApiError);
  });

  it('refuses to call out at all when unconfigured', async () => {
    delete process.env.CLARITY_API_TOKEN;
    const { fn } = stub(200, []);
    await expect(fetchClarityInsights(1)).rejects.toThrow(/not configured/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it('tolerates a non-array body instead of throwing', async () => {
    stub(200, { unexpected: true });
    await expect(fetchClarityInsights(1)).resolves.toEqual([]);
  });

  it('drops entries that are not metric objects', async () => {
    stub(200, [TRAFFIC, null, 'nonsense', { noMetricName: 1 }]);
    const out = await fetchClarityInsights(1);
    expect(out).toHaveLength(1);
    expect(out[0].metricName).toBe('Traffic');
  });
});
