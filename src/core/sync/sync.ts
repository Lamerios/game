/**
 * Progress sync between the child's devices (laptop, phone, TV…).
 *
 * Offline first: the game always plays from this browser's own storage; sync only
 * copies changes between devices when the network is there. The family's devices
 * share a family code; each device keeps one file in the cloud (`<code>/<device>`)
 * and reads the others', so two devices never overwrite each other's upload.
 * Server: server/yandex-sync (Yandex Cloud Function + Object Storage), docs/sync.md.
 */

import { analytics, type GameEvent } from '../analytics';
import { migrate, Storage } from '../storage';
import type { Profile } from '../types';
import { fingerprint, isEmptyPlan, newCode, normalizeCode, planMerge, SNAPSHOT_FORMAT, type MergePlan, type Snapshot, type Stamped } from './merge';
import { installStamps, isSyncKey, PROFILE_STAMP, readStamps, STAMPS_KEY, writeRaw } from './stamps';

const CONFIG_KEY = 'yunga-sync-config';
/** Newest events that travel; older ones stay where they were recorded. */
export const MAX_SYNC_EVENTS = 20_000;
const BOOT_WAIT_MS = 4000;
const AFTER_GAME_MS = 6000;

export interface SyncConfig {
  code?: string;
  device: string;
  /** Overrides the build's VITE_SYNC_URL (parent panel → Данные). */
  url?: string;
  last?: { at: number; ok: boolean; msg: string; devices?: number };
}

export interface SyncResult {
  ok: boolean;
  msg: string;
  /** Something from another device was written here. */
  changed?: boolean;
  plan?: MergePlan;
}

const BUILD_URL: string = import.meta.env.VITE_SYNC_URL ?? '';

function ls(): globalThis.Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export function readConfig(): SyncConfig {
  try {
    const raw = ls()?.getItem(CONFIG_KEY);
    const c = raw ? (JSON.parse(raw) as SyncConfig) : undefined;
    if (c?.device) return c;
  } catch {
    /* fall through */
  }
  const c: SyncConfig = { device: newCode(randomBytes).slice(0, 10) };
  writeConfig(c);
  return c;
}

function writeConfig(c: SyncConfig) {
  try {
    ls()?.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export const syncUrl = (c = readConfig()) => (c.url || BUILD_URL).trim();
export const syncAvailable = () => !!syncUrl();
export const syncEnabled = () => !!readConfig().code && syncAvailable();

export function setCode(code: string | undefined) {
  writeConfig({ ...readConfig(), code, last: undefined });
}

export function setUrl(url: string | undefined) {
  writeConfig({ ...readConfig(), url: url?.trim() || undefined });
}

/** Starts a new family: this device gets a fresh code to give to the others. */
export function createFamily(): string {
  const code = newCode(randomBytes);
  setCode(code);
  return code;
}

/** Link that opens the game on another device and joins it to the family. */
export function familyLink(code: string): string {
  return `${location.origin}${location.pathname}#sync=${code}`;
}

function deviceLabel(): string {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const browser = /YaBrowser/.test(ua) ? 'Яндекс Браузер' : /Edg\//.test(ua) ? 'Edge' : /Firefox/.test(ua) ? 'Firefox' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'браузер';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return `${touch ? 'Телефон/планшет' : 'Компьютер'} · ${browser}${os ? ` · ${os}` : ''}`;
}

// ---------- snapshot of this device ----------

async function localSide(storage: Storage) {
  const store = ls();
  const stamps = readStamps();
  const local: Record<string, Stamped<string>> = {};
  if (store) {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (!k || isSyncKey(k) || k === STAMPS_KEY) continue;
      local[k] = { v: store.getItem(k), t: stamps[k] ?? 0 };
    }
  }
  // Deleted keys travel as tombstones, so a reset on one device reaches the others.
  for (const [k, t] of Object.entries(stamps)) if (!(k in local) && !k.startsWith('idb:')) local[k] = { v: null, t };
  const raw = await storage.loadProfile().catch(() => undefined);
  const profile: Stamped<unknown> | undefined = raw ? { v: raw, t: stamps[PROFILE_STAMP] ?? 0 } : undefined;
  const attempts = await storage.attemptEntries().catch(() => []);
  const events = await analytics.all().catch(() => [] as GameEvent[]);
  return { local, profile, attempts, events };
}

async function snapshot(storage: Storage, device: string): Promise<Snapshot> {
  const s = await localSide(storage);
  return {
    format: SNAPSHOT_FORMAT,
    version: 1,
    device,
    label: deviceLabel(),
    savedAt: Date.now(),
    local: s.local,
    profile: s.profile,
    attempts: s.attempts,
    events: s.events.slice(-MAX_SYNC_EVENTS),
  };
}

// ---------- wire format: gzip + base64 when the browser can, plain JSON otherwise ----------

async function encode(s: Snapshot): Promise<string> {
  const json = JSON.stringify(s);
  if (typeof CompressionStream === 'undefined') return `j:${json}`;
  const buf = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `g:${btoa(bin)}`;
}

async function decode(text: string): Promise<Snapshot | undefined> {
  try {
    if (text.startsWith('j:')) return JSON.parse(text.slice(2)) as Snapshot;
    if (!text.startsWith('g:') || typeof DecompressionStream === 'undefined') return undefined;
    const bin = atob(text.slice(2));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(json) as Snapshot;
  } catch {
    return undefined;
  }
}

// ---------- applying what came from other devices ----------

type Listener = (r: SyncResult) => void;
const listeners: Listener[] = [];
/** Called after a sync wrote something from another device (e.g. to refresh the voyage profile in memory). */
export const onSynced = (l: Listener) => listeners.push(l);

async function apply(plan: MergePlan, storage: Storage) {
  for (const [k, sv] of Object.entries(plan.local)) writeRaw(k, sv.v, sv.t);
  if (plan.profile?.v) await storage.saveProfile(migrate(plan.profile.v), plan.profile.t);
  if (plan.attempts.length) await storage.putAttempts(plan.attempts);
  if (plan.events.length) await analytics.importSynced(plan.events, fingerprint);
}

// ---------- one sync round ----------

let running: Promise<SyncResult> | undefined;

/** Pull the other devices' files, merge them in, upload this device's file. */
export function syncNow(opts: { pushOnly?: boolean } = {}): Promise<SyncResult> {
  running ??= round(opts).finally(() => (running = undefined));
  return running;
}

async function round({ pushOnly = false }: { pushOnly?: boolean }): Promise<SyncResult> {
  const cfg = readConfig();
  const url = syncUrl(cfg);
  if (!cfg.code || !url) return { ok: false, msg: 'Синхронизация не настроена' };
  const storage = new Storage();
  const base = `${url}${url.includes('?') ? '&' : '?'}code=${cfg.code}`;
  let result: SyncResult = { ok: true, msg: 'Готово' };
  try {
    let devices = 1;
    if (!pushOnly) {
      const res = await fetch(base, { cache: 'no-store' });
      if (!res.ok) throw new Error(`сервер ответил ${res.status}`);
      const body = (await res.json()) as { devices?: Record<string, string> };
      const others = Object.entries(body.devices ?? {}).filter(([id]) => id !== cfg.device);
      devices += others.length;
      const remotes = (await Promise.all(others.map(([, t]) => decode(t)))).filter((s): s is Snapshot => !!s);
      const here = await localSide(storage);
      const plan = planMerge(
        {
          local: here.local,
          profile: here.profile,
          attemptKeys: new Set(here.attempts.map(([k]) => k)),
          eventPrints: new Set(here.events.map(fingerprint)),
        },
        remotes,
      );
      if (!isEmptyPlan(plan)) {
        await apply(plan, storage);
        result = { ok: true, msg: 'Готово', changed: true, plan };
      }
    }
    const put = await fetch(`${base}&device=${cfg.device}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: await encode(await snapshot(storage, cfg.device)),
    });
    if (!put.ok) throw new Error(`сервер ответил ${put.status}`);
    const prev = readConfig().last?.devices;
    writeConfig({ ...readConfig(), last: { at: Date.now(), ok: true, msg: result.msg, devices: pushOnly ? prev : devices } });
  } catch (e) {
    const msg = navigator.onLine === false ? 'Нет интернета, сохраню позже' : `Не получилось: ${(e as Error).message}`;
    result = { ok: false, msg };
    writeConfig({ ...readConfig(), last: { at: Date.now(), ok: false, msg } });
  }
  if (result.changed) listeners.forEach((l) => l(result));
  return result;
}

// ---------- automatic sync ----------

let timer: ReturnType<typeof setTimeout> | undefined;
function later(ms: number) {
  if (!syncEnabled()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

let started = false;

/**
 * Called once at boot, before the voyage profile is loaded: joins a family from
 * a `#sync=` link, then waits a few seconds for the first sync so the child sees
 * the newest progress. Offline it simply starts with what is stored here.
 */
export async function startSync(): Promise<void> {
  installStamps();
  if (started || typeof window === 'undefined') return;
  started = true;
  const m = /[#&]sync=([A-Za-z0-9-]+)/.exec(location.hash);
  if (m) {
    const code = normalizeCode(m[1] ?? '');
    if (code) setCode(code);
    history.replaceState(null, '', location.pathname + location.search);
  }
  analytics.onEvent((e) => {
    if (e.type === 'run.end') later(AFTER_GAME_MS);
  });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (!syncEnabled()) return;
    if (document.hidden) {
      hiddenAt = Date.now();
      void syncNow({ pushOnly: true });
    } else if (Date.now() - hiddenAt > 60_000) {
      void syncNow();
    }
  });
  window.addEventListener('online', () => later(1000));
  if (!syncEnabled()) return;
  await Promise.race([syncNow(), new Promise((r) => setTimeout(r, BOOT_WAIT_MS))]);
}

/** For GameState: replace the profile in memory when a newer one came from another device. */
export function syncedProfile(r: SyncResult): Profile | undefined {
  return r.plan?.profile?.v ? migrate(r.plan.profile.v) : undefined;
}
