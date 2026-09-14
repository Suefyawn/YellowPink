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

// The shape in Microsoft's own docs: counts are STRINGS, rates are numbers,
// and each metric carries whatever dimension was requested.
const TRAFFIC: ClarityMetric = {
  metricName: 'Traffic',
  information: [
    { totalSessionCount: '9554', totalBotSessionCount: '8369', distantUserCount: '189733', PagesPerSessionPercentage: 1.0931, OS: 'Other' },
    { totalSessionCount: '291942', totalBotSessionCount: '31076', distantUserCount: '212836', PagesPerSessionPercentage: 2.2609, OS: 'Android' },
  ],
};

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
  it('totals traffic across dimension rows', () => {
    const s = summarise([TRAFFIC]);
    expect(s.sessions).toBe(9554 + 291942);
    expect(s.botSessions).toBe(8369 + 31076);
    expect(s.distinctUsers).toBe(189733 + 212836);
  });

  it('averages pages-per-session and rounds to 2dp', () => {
    expect(summarise([TRAFFIC]).pagesPerSession).toBe(1.68);
  });

  it('reports null pages-per-session when Traffic is absent', () => {
    expect(summarise([]).pagesPerSession).toBeNull();
  });

  it('totals the frustration signals, which are the point of the integration', () => {
    const s = summarise([
      { metricName: 'RageClickCount', information: [{ sessionsCount: '12' }, { sessionsCount: '3' }] },
      { metricName: 'DeadClickCount', information: [{ sessionsCount: '7' }] },
      { metricName: 'QuickbackClick', information: [{ sessionsCount: '5' }] },
      { metricName: 'ScriptErrorCount', information: [{ sessionsCount: '2' }] },
    ]);
    expect(s.rageClicks).toBe(15);
    expect(s.deadClicks).toBe(7);
    expect(s.quickbackClicks).toBe(5);
    expect(s.scriptErrors).toBe(2);
  });

  it('distinguishes "zero" from "not reported" via metricsSeen', () => {
    const reported = summarise([{ metricName: 'RageClickCount', information: [{ sessionsCount: '0' }] }]);
    expect(reported.rageClicks).toBe(0);
    expect(reported.metricsSeen).toContain('RageClickCount');

    const absent = summarise([TRAFFIC]);
    expect(absent.rageClicks).toBe(0);
    expect(absent.metricsSeen).not.toContain('RageClickCount');
  });

  it('ignores metrics it does not know rather than throwing', () => {
    // The docs warn that additional metrics may appear in the response.
    expect(() => summarise([{ metricName: 'SomethingNewMicrosoftAdded', information: [{ x: 1 }] }])).not.toThrow();
  });

  it('survives a malformed information array', () => {
    const s = summarise([{ metricName: 'Traffic', information: [] }]);
    expect(s.sessions).toBe(0);
    expect(s.pagesPerSession).toBeNull();
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
