import 'fake-indexeddb/auto';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/analytics';
import { analytics } from '../src/core/analytics';
import { fingerprint, normalizeCode, planMerge, prettyCode, SNAPSHOT_FORMAT, type Snapshot } from '../src/core/sync/merge';
import { readStamps } from '../src/core/sync/stamps';
import { readConfig, setCode, setUrl, syncNow } from '../src/core/sync/sync';

const require = createRequire(import.meta.url);
const server = require('../server/yandex-sync/index.js') as { handler: (e: unknown, c: unknown) => Promise<{ statusCode: number; body: string }> };

class MemStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const ev = (ts: number, type = 'answer', data?: GameEvent['data']): GameEvent => ({ v: 1, ts, app: 'a1', game: 'snake', type, ...(data ? { data } : {}) });

const snap = (p: Partial<Snapshot>): Snapshot => ({ format: SNAPSHOT_FORMAT, version: 1, device: 'other', savedAt: 0, local: {}, attempts: [], events: [], ...p });

describe('sync merge', () => {
  const empty = () => ({ local: {}, attemptKeys: new Set<string>(), eventPrints: new Set<string>() });

  it('takes the later write of a key and keeps the newer local one', () => {
    const here = { ...empty(), local: { 'race-progress': { v: '{"l":3}', t: 200 }, 'jam-progress': { v: '{"level":5}', t: 900 } } };
    const plan = planMerge(here, [snap({ local: { 'race-progress': { v: '{"l":7}', t: 500 }, 'jam-progress': { v: '{"level":2}', t: 100 } } })]);
    expect(plan.local).toEqual({ 'race-progress': { v: '{"l":7}', t: 500 } });
  });

  it('fills missing keys even when unstamped, but never overwrites with an unstamped value', () => {
    const here = { ...empty(), local: { a: { v: 'mine', t: 0 } } };
    const plan = planMerge(here, [snap({ local: { a: { v: 'theirs', t: 0 }, b: { v: 'new', t: 0 } } })]);
    expect(plan.local).toEqual({ b: { v: 'new', t: 0 } });
  });

  it('passes deletions on and ignores tombstones of keys it never had', () => {
    const here = { ...empty(), local: { a: { v: 'x', t: 10 } } };
    const plan = planMerge(here, [snap({ local: { a: { v: null, t: 20 }, b: { v: null, t: 20 } } })]);
    expect(plan.local).toEqual({ a: { v: null, t: 20 } });
  });

  it('unions events and attempts without duplicates, across several devices', () => {
    const e1 = ev(1);
    const e2 = ev(2, 'run.end', { stars: 3 });
    const here = { ...empty(), eventPrints: new Set([fingerprint(e1)]), attemptKeys: new Set(['1-math-x']) };
    const att = { ts: 1, skill: 'math', level: 1, itemId: 'x', outcome: 'first_try', hintsUsed: 0, durationMs: 1 } as const;
    const plan = planMerge(here, [
      snap({ events: [e1, e2], attempts: [['1-math-x', att], ['2-math-y', { ...att, ts: 2, itemId: 'y' }]] }),
      snap({ device: 'third', events: [e2] }),
    ]);
    expect(plan.events).toEqual([e2]);
    expect(plan.attempts.map(([k]) => k)).toEqual(['2-math-y']);
  });

  it('takes the newer voyage profile', () => {
    const plan = planMerge({ ...empty(), profile: { v: { a: 1 }, t: 5 } }, [snap({ profile: { v: { a: 2 }, t: 9 } })]);
    expect(plan.profile).toEqual({ v: { a: 2 }, t: 9 });
  });

  it('reads a family code from a typed code or a link', () => {
    expect(normalizeCode('ABCD-efgh-2345-mnpq')).toBe('abcdefgh2345mnpq');
    expect(normalizeCode('https://x.github.io/game/#sync=abcdefgh2345mnpq')).toBe('abcdefgh2345mnpq');
    expect(normalizeCode('short')).toBeUndefined();
    expect(prettyCode('abcdefgh2345mnpq')).toBe('abcd-efgh-2345-mnpq');
  });
});

/** In-memory Object Storage behind the real function code. */
function fakeCloud() {
  const objects = new Map<string, string>();
  const s3 = async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const key = decodeURIComponent(u.pathname.split('/').slice(2).join('/'));
    expect((init.headers as Record<string, string>)['X-YaCloud-SubjectToken']).toBe('iam');
    if (init.method === 'PUT') {
      objects.set(key, String(init.body));
      return new Response('', { status: 200 });
    }
    if (!key) {
      const prefix = u.searchParams.get('prefix') ?? '';
      const xml = [...objects.keys()].filter((k) => k.startsWith(prefix)).map((k) => `<Contents><Key>${k}</Key><LastModified>2026-11-25T00:00:00Z</LastModified></Contents>`).join('');
      return new Response(`<ListBucketResult>${xml}</ListBucketResult>`);
    }
    return objects.has(key) ? new Response(objects.get(key)) : new Response('', { status: 404 });
  };
  /** What the browser's fetch sees: the function's public URL. */
  const call = async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const realFetch = globalThis.fetch;
    globalThis.fetch = s3 as typeof fetch;
    try {
      const r = await server.handler(
        { httpMethod: init.method ?? 'GET', queryStringParameters: Object.fromEntries(u.searchParams), body: init.body as string, isBase64Encoded: false },
        { token: { access_token: 'iam' } },
      );
      return new Response(r.statusCode === 204 ? null : r.body, { status: r.statusCode });
    } finally {
      globalThis.fetch = realFetch;
    }
  };
  return { objects, call };
}

describe('sync function (Yandex Cloud)', () => {
  beforeEach(() => {
    process.env.BUCKET = 'yunga';
  });

  it('rejects guessable or malformed codes', async () => {
    const r = await server.handler({ httpMethod: 'GET', queryStringParameters: { code: 'abc' } }, { token: { access_token: 'iam' } });
    expect(r.statusCode).toBe(400);
  });

  it('stores one file per device and returns all of a family’s files', async () => {
    const cloud = fakeCloud();
    expect((await cloud.call('https://f/?code=abcdefgh2345mnpq&device=dev1', { method: 'PUT', body: 'j:{}' })).status).toBe(204);
    await cloud.call('https://f/?code=abcdefgh2345mnpq&device=dev2', { method: 'PUT', body: 'j:[]' });
    await cloud.call('https://f/?code=zzzzzzzz2345mnpq&device=dev3', { method: 'PUT', body: 'j:0' });
    const body = (await (await cloud.call('https://f/?code=abcdefgh2345mnpq')).json()) as { devices: Record<string, string> };
    expect(body.devices).toEqual({ dev1: 'j:{}', dev2: 'j:[]' });
  });
});

describe('sync round', () => {
  it('brings another device’s progress here and uploads this device’s own', async () => {
    process.env.BUCKET = 'yunga';
    (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
    const cloud = fakeCloud();
    globalThis.fetch = cloud.call as typeof fetch;
    const code = 'abcdefgh2345mnpq';
    const remoteEvent = ev(1_700_000_000_000, 'run.end', { stars: 2 });
    cloud.objects.set(`${code}/phone1`, `j:${JSON.stringify(snap({ device: 'phone1', local: { 'race-progress': { v: '{"level":6}', t: 1000 } }, events: [remoteEvent] }))}`);
    localStorage.setItem('jam-progress', '{"level":3}');
    setUrl('https://functions.example/sync');
    setCode(code);

    const r = await syncNow();
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(true);
    expect(localStorage.getItem('race-progress')).toBe('{"level":6}');
    expect(readStamps()['race-progress']).toBe(1000);
    expect((await analytics.all()).some((e) => fingerprint(e) === fingerprint(remoteEvent))).toBe(true);

    const mine = cloud.objects.get(`${code}/${readConfig().device}`);
    expect(mine).toBeTruthy();

    // A second round changes nothing: the event is not imported twice.
    const again = await syncNow();
    expect(again.changed).toBeFalsy();
    expect((await analytics.all()).filter((e) => fingerprint(e) === fingerprint(remoteEvent))).toHaveLength(1);

    // A brand-new browser joins with the code and gets this device's (compressed) upload.
    (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
    setUrl('https://functions.example/sync');
    setCode(code);
    expect((await syncNow()).ok).toBe(true);
    expect(localStorage.getItem('jam-progress')).toBe('{"level":3}');
    expect(localStorage.getItem('race-progress')).toBe('{"level":6}');
  });
});
