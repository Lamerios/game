import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAMES, gameByHash } from '../src/games/registry';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : p.endsWith('.ts') ? [readFileSync(p, 'utf8')] : [];
  });
}

describe('Game registry', () => {
  it('has unique ids that are safe in a URL hash', () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('points every card at a scene that exists and is registered in main.ts', () => {
    const files = sources('src');
    const main = readFileSync('src/main.ts', 'utf8');
    for (const g of GAMES) {
      const file = files.find((f) => f.includes(`super('${g.scene}')`));
      expect(file, `scene ${g.scene}`).toBeDefined();
      const cls = file!.match(/export class (\w+) extends/)![1]!;
      expect(main).toMatch(new RegExp(`scene: \\[[^\\]]*\\b${cls}\\b`));
    }
  });

  it('opens games from #hash links', () => {
    expect(gameByHash('#snake')?.scene).toBe('Snake');
    expect(gameByHash('#race')?.scene).toBe('Race');
    expect(gameByHash('')).toBeUndefined();
  });
});
