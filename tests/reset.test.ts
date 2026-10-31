import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Storage } from '../src/core/storage';
import { GameState } from '../src/game-state';

describe('GameState.reset', () => {
  it('wipes progress and the day limit but keeps the name', async () => {
    const st = new Storage('reset-1');
    const g = await GameState.load(st);
    await g.markSeen('intro');
    await g.beginOrResume(Date.now());
    g.profile = { ...g.profile, route: { ...g.profile.route, islandIndex: 5 }, sessionLog: [{ startedAt: Date.now(), endedAt: Date.now(), tasksDone: 6 } as never] };
    await g.reset();
    expect(g.seen('intro')).toBe(false);
    expect(g.profile.route.islandIndex).toBe(0);
    expect(g.profile.sessionLog).toEqual([]);
    expect(g.profile.currentSession).toBeUndefined();
    expect(g.profile.childName).toBe('Артемий');
    expect(g.gate().allowed).toBe(true);
    const again = await GameState.load(st);
    expect(again.profile.route.islandIndex).toBe(0);
    expect(again.seen('intro')).toBe(false);
  });
});
