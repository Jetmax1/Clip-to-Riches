// IndexedDB save storage with versioned envelopes, validation and a memory fallback.

import { BALANCE } from '../data/balance';
import { SAVE_VERSION } from '../sim/initialState';
import { dayOf } from '../sim/time';
import type { GameState } from '../types/game';
import { findNonFinite, validateSave } from './validate';

export type SlotId = 'autosave' | 'slot1' | 'slot2' | 'slot3';
export const SLOT_IDS: SlotId[] = ['autosave', 'slot1', 'slot2', 'slot3'];

export interface SaveEnvelope {
  slot: SlotId;
  version: number;
  savedAt: number; // real epoch ms
  /** True when the game clock was paused at save time (no offline progress on load). */
  paused?: boolean;
  summary: { day: number; cash: number; followers: number; clips: number };
  state: unknown;
}

export interface SlotInfo {
  slot: SlotId;
  empty: boolean;
  corrupted: boolean;
  error?: string;
  savedAt?: number;
  summary?: SaveEnvelope['summary'];
}

export type LoadResult =
  | { ok: true; state: GameState; savedAt: number; paused: boolean; repaired: string[] }
  | { ok: false; error: string; empty?: boolean };

const DB_NAME = 'clip-to-riches';
const STORE = 'saves';
const EMERGENCY_KEY = 'ctr-emergency-autosave';
const OPEN_TIMEOUT_MS = 4000;

interface Backend {
  get(slot: SlotId): Promise<unknown>;
  put(slot: SlotId, value: SaveEnvelope): Promise<void>;
  del(slot: SlotId): Promise<void>;
}

function idbBackend(factory: IDBFactory): Backend {
  let dbp: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => {
    if (!dbp) {
      dbp = new Promise<IDBDatabase>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Opening save storage timed out')), OPEN_TIMEOUT_MS);
        const req = factory.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => {
          clearTimeout(timer);
          const db = req.result;
          db.onversionchange = () => {
            db.close();
            dbp = null;
          };
          resolve(db);
        };
        req.onerror = () => {
          clearTimeout(timer);
          reject(req.error ?? new Error('IndexedDB open failed'));
        };
        req.onblocked = () => {
          clearTimeout(timer);
          reject(new Error('Save storage is blocked by another tab'));
        };
      }).catch((e: unknown) => {
        dbp = null; // allow a retry next time instead of caching the failure forever
        throw e;
      });
    }
    return dbp;
  };
  const read = (slot: SlotId): Promise<unknown> =>
    open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get(slot);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
        }),
    );
  /** Writes resolve only when the transaction commits, and reject on abort. */
  const write = (fn: (s: IDBObjectStore) => void): Promise<void> =>
    open().then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error ?? new Error('Save was aborted'));
          tx.onerror = () => reject(tx.error ?? new Error('Save failed'));
          fn(tx.objectStore(STORE));
        }),
    );
  return {
    get: read,
    put: (slot, value) => write((s) => void s.put(value, slot)),
    del: (slot) => write((s) => void s.delete(slot)),
  };
}

function memoryBackend(): Backend {
  const m = new Map<SlotId, unknown>();
  return {
    get: async (slot) => m.get(slot),
    put: async (slot, v) => void m.set(slot, structuredClone(v)),
    del: async (slot) => void m.delete(slot),
  };
}

function summarize(state: GameState): SaveEnvelope['summary'] {
  const followers = state.platforms.blink.followers + state.platforms.tubely.followers + state.platforms.chirp.followers;
  return { day: dayOf(state.minute), cash: state.cash, followers, clips: state.published.length };
}

function envelope(slot: SlotId, state: GameState, paused: boolean): SaveEnvelope {
  const bad = findNonFinite(state);
  if (bad) throw new Error(`Refusing to save an invalid number at ${bad}`);
  return {
    slot,
    version: SAVE_VERSION,
    savedAt: Date.now(),
    paused,
    summary: summarize(state),
    state: JSON.parse(JSON.stringify(state)) as unknown,
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export class SaveSystem {
  private backend: Backend;
  readonly persistent: boolean;

  constructor(factory: IDBFactory | undefined = typeof indexedDB !== 'undefined' ? indexedDB : undefined) {
    this.persistent = !!factory;
    this.backend = factory ? idbBackend(factory) : memoryBackend();
  }

  async save(slot: SlotId, state: GameState, paused = false): Promise<void> {
    await this.backend.put(slot, envelope(slot, state, paused));
  }

  async load(slot: SlotId): Promise<LoadResult> {
    let raw: unknown;
    try {
      raw = await this.backend.get(slot);
    } catch (e) {
      return { ok: false, error: `Could not read save: ${(e as Error).message}` };
    }
    if (raw === undefined || raw === null) return { ok: false, error: 'Empty slot.', empty: true };
    if (typeof raw !== 'object' || !('state' in (raw as object))) return { ok: false, error: 'Save file is corrupted (bad envelope).' };
    const env = raw as Partial<SaveEnvelope>;
    if (isNum(env.version) && env.version > SAVE_VERSION) return { ok: false, error: `Save is from a newer version of the game (v${env.version}).` };
    const v = validateSave(env.state);
    if (!v.ok) return { ok: false, error: v.error };
    const savedAt = isNum(env.savedAt) && env.savedAt <= Date.now() ? env.savedAt : Date.now();
    return { ok: true, state: v.state, savedAt, paused: env.paused === true, repaired: v.repaired };
  }

  async info(slot: SlotId): Promise<SlotInfo> {
    let raw: unknown;
    try {
      raw = await this.backend.get(slot);
    } catch (e) {
      return { slot, empty: false, corrupted: true, error: (e as Error).message };
    }
    if (raw === undefined || raw === null) return { slot, empty: true, corrupted: false };
    const env = raw as Partial<SaveEnvelope>;
    const v = validateSave(env.state);
    if (!v.ok) return { slot, empty: false, corrupted: true, error: v.error };
    // Summary is derived from the validated state, not trusted from the envelope.
    return { slot, empty: false, corrupted: false, savedAt: isNum(env.savedAt) ? env.savedAt : undefined, summary: summarize(v.state) };
  }

  async listSlots(): Promise<SlotInfo[]> {
    return Promise.all(SLOT_IDS.map((s) => this.info(s)));
  }

  async remove(slot: SlotId): Promise<void> {
    await this.backend.del(slot);
  }

  /** Test/debug helper: write arbitrary raw data to a slot. */
  async writeRaw(slot: SlotId, raw: unknown): Promise<void> {
    await this.backend.put(slot, raw as SaveEnvelope);
  }

  /**
   * Synchronous snapshot for page unload, when async IndexedDB writes may never finish.
   * Reconciled into the autosave slot on next boot by recoverEmergency().
   */
  saveEmergency(state: GameState, paused: boolean): void {
    try {
      localStorage.setItem(EMERGENCY_KEY, JSON.stringify(envelope('autosave', state, paused)));
    } catch {
      /* storage full or blocked: nothing more we can do during unload */
    }
  }

  /** If the unload snapshot is newer than the autosave, promote it. Returns true if recovered. */
  async recoverEmergency(): Promise<boolean> {
    let text: string | null = null;
    try {
      text = localStorage.getItem(EMERGENCY_KEY);
    } catch {
      return false;
    }
    if (!text) return false;
    try {
      const env = JSON.parse(text) as SaveEnvelope;
      if (!isNum(env.savedAt) || !validateSave(env.state).ok) return false;
      const current = (await this.backend.get('autosave')) as Partial<SaveEnvelope> | undefined;
      const currentAt = current && isNum(current.savedAt) ? current.savedAt : 0;
      if (env.savedAt > currentAt) {
        await this.backend.put('autosave', env);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      try {
        localStorage.removeItem(EMERGENCY_KEY);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Game minutes of offline progress to apply, capped. */
export function offlineMinutes(savedAt: number, now: number = Date.now()): number {
  const elapsed = Math.max(0, now - savedAt);
  return Math.min(BALANCE.offlineCapMinutes, Math.floor(elapsed / BALANCE.realMsPerGameMinute));
}

export const saveSystem = new SaveSystem();
