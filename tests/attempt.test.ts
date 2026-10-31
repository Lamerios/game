import { describe, expect, it } from 'vitest';
import { Attempt } from '../src/games/common/attempt';

describe('Attempt', () => {
  it('no mistakes → first_try', () => {
    expect(new Attempt(0).outcome()).toBe('first_try');
  });
  it('one mistake → with_hint, step 1', () => {
    const a = new Attempt(0);
    expect(a.wrong()).toEqual({ hint: 1, lock: false });
    expect(a.outcome()).toBe('with_hint');
  });
  it('two mistakes in a row force a hint with input lock', () => {
    const a = new Attempt(0);
    a.wrong();
    expect(a.wrong()).toEqual({ hint: 2, lock: true });
  });
  it('fourth step shows the solution → shown', () => {
    const a = new Attempt(0);
    for (let i = 0; i < 4; i++) a.wrong();
    expect(a.solutionShown).toBe(true);
    expect(a.outcome()).toBe('shown');
  });
  it('asking the parrot climbs the ladder without a mistake', () => {
    const a = new Attempt(0);
    expect(a.askHelp()).toBe(1);
    expect(a.outcome()).toBe('with_hint');
  });
});
