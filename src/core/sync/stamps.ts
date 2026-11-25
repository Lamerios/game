/**
 * When each piece of saved progress was last written on this device, so that
 * sync can tell which device has the newer value (last write wins).
 *
 * localStorage writes are stamped by patching Storage.prototype once (the games
 * call localStorage.setItem directly, in many places); the IndexedDB profile is
 * stamped by Storage.saveProfile. Stamps live in localStorage under STAMPS_KEY.
 */

export const STAMPS_KEY = 'yunga-sync-stamps';
/** Sync's own keys never travel. */
export const isSyncKey = (k: string) => k.startsWith('yunga-sync');
export const PROFILE_STAMP = 'idb:profile';

const ls = (): globalThis.Storage | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

let original: { set: (k: string, v: string) => void; remove: (k: string) => void } | undefined;

export function readStamps(): Record<string, number> {
  try {
    const raw = ls()?.getItem(STAMPS_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : {};
    return v && typeof v === 'object' ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeStamps(s: Record<string, number>) {
  const store = ls();
  if (!store) return;
  try {
    (original?.set ?? store.setItem).call(store, STAMPS_KEY, JSON.stringify(s));
  } catch {
    /* storage full: the next write tries again */
  }
}

export function stamp(key: string, t = Date.now()) {
  const s = readStamps();
  s[key] = t;
  writeStamps(s);
}

/** Writes a value from another device with that device's stamp (no new stamp). */
export function writeRaw(key: string, value: string | null, t: number) {
  const store = ls();
  if (!store) return;
  if (value === null) (original?.remove ?? store.removeItem).call(store, key);
  else (original?.set ?? store.setItem).call(store, key, value);
  stamp(key, t);
}

/** Stamps every localStorage write from now on. Safe to call more than once. */
export function installStamps() {
  if (original || typeof globalThis.Storage === 'undefined' || !ls()) return;
  const proto = globalThis.Storage.prototype;
  const set = proto.setItem;
  const remove = proto.removeItem;
  original = { set, remove };
  proto.setItem = function (this: globalThis.Storage, k: string, v: string) {
    set.call(this, k, v);
    if (this === ls() && !isSyncKey(k)) stamp(k);
  };
  proto.removeItem = function (this: globalThis.Storage, k: string) {
    remove.call(this, k);
    if (this === ls() && !isSyncKey(k)) stamp(k);
  };
}
