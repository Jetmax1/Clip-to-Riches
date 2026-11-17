import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { offlineMinutes, SaveSystem } from '../src/save/saveSystem';
import { validateSave } from '../src/save/validate';
import { createNewGame, SAVE_VERSION } from '../src/sim/initialState';

describe('save validation', () => {
  it('accepts a fresh game unchanged', () => {
    const g = createNewGame(5);
    const v = validateSave(JSON.parse(JSON.stringify(g)));
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.state).toEqual(g);
      expect(v.repaired).toEqual([]);
    }
  });

  it('rejects garbage and saves from the future', () => {
    expect(validateSave(null).ok).toBe(false);
    expect(validateSave('hello').ok).toBe(false);
    expect(validateSave({ foo: 1 }).ok).toBe(false);
    expect(validateSave({ ...createNewGame(1), version: SAVE_VERSION + 5 }).ok).toBe(false);
  });

  it('repairs out-of-range numbers and drops corrupted clips', () => {
    const g = createNewGame(5) as unknown as Record<string, unknown>;
    const v = validateSave({ ...g, cash: -50, energy: 999, reputation: 'x', published: [{ id: 'bad' }] });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.state.cash).toBe(0);
      expect(v.state.energy).toBe(BALANCE.maxEnergy);
      expect(v.state.reputation).toBe(0);
      expect(v.state.published).toHaveLength(0);
      expect(v.repaired.length).toBeGreaterThan(0);
    }
  });

  it('migrates an old version-0 save', () => {
    const { version: _v, ...old } = createNewGame(5);
    const v = validateSave(old);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.state.version).toBe(SAVE_VERSION);
  });
});

describe('SaveSystem (IndexedDB)', () => {
  it('round-trips a game through IndexedDB', async () => {
    const sys = new SaveSystem(new IDBFactory());
    const g = createNewGame(77);
    g.cash = 1234.5;
    await sys.save('slot1', g);
    const r = await sys.load('slot1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.cash).toBe(1234.5);
    const info = await sys.info('slot1');
    expect(info.summary?.cash).toBe(1234.5);
  });

  it('reports empty and corrupted slots safely', async () => {
    const sys = new SaveSystem(new IDBFactory());
    const empty = await sys.load('slot2');
    expect(empty.ok).toBe(false);
    await sys.writeRaw('slot3', { state: { nonsense: true } });
    const bad = await sys.load('slot3');
    expect(bad.ok).toBe(false);
    expect((await sys.info('slot3')).corrupted).toBe(true);
    await sys.remove('slot3');
    expect((await sys.info('slot3')).empty).toBe(true);
  });

  it('caps offline progress', () => {
    expect(offlineMinutes(Date.now() - 1000 * 60 * 60 * 24 * 3)).toBe(BALANCE.offlineCapMinutes);
    expect(offlineMinutes(Date.now() - BALANCE.realMsPerGameMinute * 10)).toBe(10);
    expect(offlineMinutes(Date.now() + 99999)).toBe(0);
  });
});
