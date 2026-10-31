import { createStore, get, set, del, entries, clear, type UseStore } from 'idb-keyval';
import { SKILLS, type AttemptLog, type Profile } from './types';
import { DEFAULT_CHILD_NAME, MAX_LEVELS, START_LEVELS } from './profile';

const PROFILE_KEY = 'profile';

export class Storage {
  private readonly profiles: UseStore;
  private readonly attempts: UseStore;

  constructor(dbPrefix = 'yunga') {
    this.profiles = createStore(`${dbPrefix}-profile`, 'kv');
    this.attempts = createStore(`${dbPrefix}-attempts`, 'kv');
  }

  async loadProfile(): Promise<Profile | undefined> {
    const raw = await get<unknown>(PROFILE_KEY, this.profiles);
    return raw === undefined ? undefined : migrate(raw);
  }

  saveProfile(profile: Profile): Promise<void> {
    return set(PROFILE_KEY, profile, this.profiles);
  }

  async resetProfile(): Promise<void> {
    await del(PROFILE_KEY, this.profiles);
    await clear(this.attempts);
  }

  logAttempt(a: AttemptLog): Promise<void> {
    return set(`${a.ts}-${a.skill}-${a.itemId}`, a, this.attempts);
  }

  async attemptsSince(ts: number): Promise<AttemptLog[]> {
    const all = await entries<string, AttemptLog>(this.attempts);
    return all.map(([, v]) => v).filter((a) => a.ts >= ts).sort((a, b) => a.ts - b.ts);
  }

  /** Export for moving progress between devices (SDD section 2). */
  async exportJson(): Promise<string> {
    const profile = await this.loadProfile();
    const attempts = await this.attemptsSince(0);
    return JSON.stringify({ format: 'yunga-export', version: 1, profile, attempts });
  }

  async importJson(json: string): Promise<void> {
    const data = JSON.parse(json) as { format?: string; profile?: unknown; attempts?: AttemptLog[] };
    if (data.format !== 'yunga-export' || !data.profile) throw new Error('Неизвестный формат файла');
    const profile = migrate(data.profile);
    await this.resetProfile();
    await this.saveProfile(profile);
    for (const a of data.attempts ?? []) await this.logAttempt(a);
  }
}

/** Brings stored data up to the current schema. */
export function migrate(raw: unknown): Profile {
  const p = raw as { schemaVersion?: number } & Omit<Profile, 'schemaVersion'>;
  if (p?.schemaVersion === 2) return p as Profile;
  if (p?.schemaVersion === 1) return fromV1(p);
  throw new Error(`Неподдерживаемая версия профиля: ${String(p?.schemaVersion)}`);
}

/**
 * v1 → v2 (story season): the child gets a name, levels start higher, and the
 * route restarts so the season's story begins from the prologue.
 */
function fromV1(p: Omit<Profile, 'schemaVersion'>): Profile {
  const skills = Object.fromEntries(
    SKILLS.map((s) => {
      const old = p.skills[s];
      const level = Math.max(old?.level ?? 1, START_LEVELS[s]);
      return [s, { ...old, level, maxLevel: MAX_LEVELS[s], window: level === old?.level ? old.window : [] }];
    }),
  ) as Profile['skills'];
  return {
    ...p,
    schemaVersion: 2,
    childName: !p.childName || p.childName === 'Юнга' ? DEFAULT_CHILD_NAME : p.childName,
    skills,
    route: { ...p.route, islandIndex: 0 },
    inventory: {},
    currentSession: undefined,
    calibrating: true,
  };
}
