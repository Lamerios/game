/**
 * Pure part of progress sync: what a device's snapshot looks like and how
 * snapshots from several devices merge. No browser APIs here (tested in node).
 *
 * Rules (see docs/sync.md):
 * - localStorage keys (per-game progress, word stats…): last write wins, by the
 *   time the key was written on its device. A key nobody has stamped yet (written
 *   before sync existed) is taken from another device only when it is missing here.
 * - The voyage profile: last write wins, the same way.
 * - Voyage attempts and the event log: union, nothing is lost.
 */

import type { GameEvent } from '../analytics';
import type { AttemptLog } from '../types';

export const SNAPSHOT_FORMAT = 'yunga-sync';

/** A value and when it was written (epoch ms; 0 = before sync existed). `null` value = deleted. */
export interface Stamped<T> {
  v: T | null;
  t: number;
}

export interface Snapshot {
  format: typeof SNAPSHOT_FORMAT;
  version: 1;
  device: string;
  /** Human label: 'touch' / 'desktop' and the browser, for the parent panel. */
  label?: string;
  savedAt: number;
  local: Record<string, Stamped<string>>;
  profile?: Stamped<unknown>;
  attempts: [string, AttemptLog][];
  events: GameEvent[];
}

/** What to change on this device after merging remote snapshots into it. */
export interface MergePlan {
  local: Record<string, Stamped<string>>;
  profile?: Stamped<unknown>;
  attempts: [string, AttemptLog][];
  events: GameEvent[];
}

/** Stable identity of an event, the same on every device (events carry no id of their own). */
export function fingerprint(e: GameEvent): string {
  const s = `${e.ts}|${e.app}|${e.run ?? ''}|${e.game}|${e.type}|${e.data ? JSON.stringify(e.data) : ''}`;
  // FNV-1a, 2 × 32 bit: short and collision-safe enough for a family's events.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/** Later write wins; an unstamped value (t = 0) only fills a gap. */
function wins<T>(remote: Stamped<T>, local: Stamped<T> | undefined): boolean {
  if (!local) return remote.v !== null;
  if (remote.t === 0) return false;
  return remote.t > local.t;
}

export interface LocalState {
  local: Record<string, Stamped<string>>;
  profile?: Stamped<unknown>;
  attemptKeys: Set<string>;
  eventPrints: Set<string>;
}

export function planMerge(here: LocalState, remotes: Snapshot[]): MergePlan {
  const plan: MergePlan = { local: {}, attempts: [], events: [] };
  const local = { ...here.local };
  let profile = here.profile;
  const attempts = new Set(here.attemptKeys);
  const prints = new Set(here.eventPrints);
  for (const r of remotes) {
    if (r?.format !== SNAPSHOT_FORMAT || r.version !== 1) continue;
    for (const [k, rv] of Object.entries(r.local ?? {})) {
      if (!rv || typeof rv.t !== 'number' || (rv.v !== null && typeof rv.v !== 'string')) continue;
      if (wins(rv, local[k])) {
        local[k] = rv;
        plan.local[k] = rv;
      }
    }
    if (r.profile && r.profile.v !== null && wins(r.profile, profile)) {
      profile = r.profile;
      plan.profile = r.profile;
    }
    for (const [k, a] of r.attempts ?? []) {
      if (attempts.has(k)) continue;
      attempts.add(k);
      plan.attempts.push([k, a]);
    }
    for (const e of r.events ?? []) {
      if (!e || typeof e.ts !== 'number') continue;
      const fp = fingerprint(e);
      if (prints.has(fp)) continue;
      prints.add(fp);
      plan.events.push(e);
    }
  }
  return plan;
}

export const isEmptyPlan = (p: MergePlan) => !Object.keys(p.local).length && !p.profile && !p.attempts.length && !p.events.length;

/** Family code: 16 letters/digits without look-alikes, shown as xxxx-xxxx-xxxx-xxxx. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function newCode(random: (n: number) => Uint8Array): string {
  const bytes = random(16);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Accepts what a parent may type or paste: spaces, dashes, capitals, a whole link. */
export function normalizeCode(input: string): string | undefined {
  const m = /sync=([A-Za-z0-9-]+)/.exec(input);
  const raw = (m?.[1] ?? input).toLowerCase().replace(/[\s-]/g, '');
  return /^[a-z0-9]{16,64}$/.test(raw) ? raw : undefined;
}

export const prettyCode = (code: string) => code.match(/.{1,4}/g)!.join('-');
