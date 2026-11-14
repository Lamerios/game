/**
 * Coins the child keeps across mini-games. Used where the game offers a choice
 * between a small reward now and a bigger one later: the promise is always
 * kept, because children wait longer when promises are reliable (Kidd et al., 2013).
 */
export const TREASURE_KEY = 'treasure';

export function coins(): number {
  try {
    const n = Number(localStorage.getItem(TREASURE_KEY) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function addCoins(n: number): number {
  const total = coins() + Math.max(0, Math.floor(n));
  try {
    localStorage.setItem(TREASURE_KEY, String(total));
  } catch {
    /* private mode */
  }
  return total;
}
