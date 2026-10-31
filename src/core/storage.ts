import { createStore, get, set, del, entries, clear, type UseStore } from 'idb-keyval';
import type { AttemptLog, Profile } from './types';

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

/** Brings stored data up to the current schema. Only v1 exists so far. */
export function migrate(raw: unknown): Profile {
  const p = raw as Partial<Profile>;
  if (p?.schemaVersion !== 1) throw new Error(`Неподдерживаемая версия профиля: ${String(p?.schemaVersion)}`);
  return p as Profile;
}
