/** Small seeded RNG so generators are reproducible in tests. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
