import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createProfile } from '../src/core/profile';
import { migrate, Storage } from '../src/core/storage';

describe('Storage', () => {
  it('saves and loads a profile', async () => {
    const st = new Storage('t1');
    expect(await st.loadProfile()).toBeUndefined();
    const p = createProfile('Миша', { math: 3 });
    await st.saveProfile(p);
    expect(await st.loadProfile()).toEqual(p);
  });

  it('round-trips export/import between "devices"', async () => {
    const a = new Storage('dev-a');
    const p = createProfile('Миша', { reading: 4 });
    await a.saveProfile(p);
    await a.logAttempt({ ts: 1, skill: 'reading', level: 4, itemId: 'w1', outcome: 'first_try', hintsUsed: 0, durationMs: 900 });
    const json = await a.exportJson();

    const b = new Storage('dev-b');
    await b.importJson(json);
    expect(await b.loadProfile()).toEqual(p);
    expect(await b.attemptsSince(0)).toHaveLength(1);
  });

  it('rejects foreign files', async () => {
    await expect(new Storage('t2').importJson('{"x":1}')).rejects.toThrow();
  });

  it('migrate rejects unknown schema versions', () => {
    expect(() => migrate({ schemaVersion: 99 })).toThrow();
  });
});
