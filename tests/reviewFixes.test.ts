// Regression tests for the issues found in the multi-agent review.
import 'fake-indexeddb/auto';
import { produce } from 'immer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { PLATFORMS } from '../src/data/platforms';
import { getStreamer, STREAMERS } from '../src/data/streamers';
import { saveSystem, SaveSystem } from '../src/save/saveSystem';
import { findNonFinite, validateSave } from '../src/save/validate';
import * as engine from '../src/sim/engine';
import { createNewGame } from '../src/sim/initialState';
import { computeQuality, inferTitleStyle, momentTaste } from '../src/sim/quality';
import { estimateChat, generateSession, generateTrends, getSession, sessionKey } from '../src/sim/streams';
import { dayStart, streamDayOf } from '../src/sim/time';
import { useGame } from '../src/state/store';
import type { ActionResult, ClipDraft, GameState, StreamMoment } from '../src/types/game';

const apply = (s: GameState, fn: (d: GameState) => ActionResult): [GameState, ActionResult] => {
  let r: ActionResult = { ok: false, reason: '' };
  const next = produce(s, (d) => {
    r = fn(d);
  });
  return [next, r];
};
const at = (s: GameState, minute: number): GameState => produce(s, (d) => void (d.minute = minute));

/** Scan segments of a streamer until a moment is found; returns the state and moment id. */
function scanUntilMoment(s0: GameState, streamerId: string): { s: GameState; momentId: string } {
  // Make sure most of the day's streams have aired (16:00 of the current broadcast day).
  const afternoon = dayStart(streamDayOf(s0.minute)) + 16 * 60;
  let s = s0.minute < afternoon ? at(s0, afternoon) : s0;
  const sess = getSession(s.worldSeed, getStreamer(streamerId), streamDayOf(s.minute));
  for (const seg of sess.segments) {
    if (s.minute < seg.endMinute) break;
    const [n, r] = apply(s, (d) => engine.scanSegment(d, streamerId, seg.index));
    if (!r.ok) continue;
    s = n;
    if (seg.momentIds[0]) return { s, momentId: seg.momentIds[0] };
  }
  throw new Error('no moment found');
}

function readyDraft(s0: GameState, streamerId: string, draftId: string): GameState {
  const { s, momentId } = scanUntilMoment(s0, streamerId);
  let [n] = apply(s, (d) => engine.startDraft(d, streamerId, streamDayOf(d.minute), momentId, draftId));
  [n] = apply(n, (d) => engine.finishDraft(d, draftId));
  return n;
}

describe('late night streams & VOD expiry', () => {
  const chaos = getStreamer('chaosking'); // 18:00–24:00

  it("ChaosKing's last segment is scannable after midnight", () => {
    const s = at(createNewGame(11), dayStart(2)); // 00:00 of day 2
    const sess = getSession(s.worldSeed, chaos, 1);
    const last = sess.segments[sess.segments.length - 1]!;
    expect(streamDayOf(s.minute)).toBe(1);
    const [, r] = apply(s, (d) => engine.scanSegment(d, 'chaosking', last.index));
    expect(r.ok).toBe(true);
  });

  it('a scan that crosses midnight keeps its record', () => {
    const s = at(createNewGame(11), dayStart(1) + 23 * 60 + 45);
    const [n, r] = apply(s, (d) => engine.scanSegment(d, 'chaosking', 0));
    expect(r.ok).toBe(true);
    expect(n.scanned[sessionKey('chaosking', 1)]).toContain(0);
  });

  it('VODs expire at 08:00 and scans that would cross it are refused', () => {
    let s = at(createNewGame(11), dayStart(2) + 7 * 60 + 50);
    const [, refused] = apply(s, (d) => engine.scanSegment(d, 'chaosking', 1));
    expect(refused.ok).toBe(false);
    s = produce(s, (d) => void (d.scanned[sessionKey('chaosking', 1)] = [0]));
    s = produce(s, (d) => void engine.advanceTime(d, 20));
    expect(s.scanned[sessionKey('chaosking', 1)]).toBeUndefined();
  });
});

describe('economy pressure', () => {
  it('Chirp pays less per view than the gated platforms, which need real audiences', () => {
    expect(PLATFORMS.chirp.monetization.rpm).toBeLessThan(PLATFORMS.blink.monetization.rpm);
    expect(PLATFORMS.blink.monetization.minFollowers).toBeGreaterThanOrEqual(400);
    expect(PLATFORMS.tubely.monetization.minTotalViews).toBeGreaterThanOrEqual(20000);
  });

  it('three missed rent weeks evicts the player and blocks actions', () => {
    let s = produce(createNewGame(5), (d) => void (d.cash = 0));
    s = produce(s, (d) => void engine.advanceTime(d, 7 * 3 * 24 * 60 + 60));
    expect(s.missedRent).toBe(BALANCE.rent.evictAfterMissed);
    expect(s.gameOver).toMatch(/Evicted/);
    const [, r] = apply(s, (d) => engine.buyDrink(d));
    expect(r.ok).toBe(false);
  });

  it('energy drinks escalate in price and cause a morning crash', () => {
    let s = produce(createNewGame(5), (d) => void (d.energy = 0));
    for (let i = 0; i < 3; i++) s = apply(s, (d) => engine.buyDrink(d))[0];
    expect(s.drinksToday).toBe(3);
    s = produce(s, (d) => void (d.minute = dayStart(1) + 22 * 60));
    const { crash } = engine.sleepEnergyGain(s);
    expect(crash).toBe(2 * BALANCE.drink.crashPerExtraDrink);
  });

  it('sleep restores energy by hours slept (no full refill from a 1-minute nap)', () => {
    const s = produce(at(createNewGame(5), dayStart(2) + 7 * 60 + 59), (d) => void (d.energy = 10));
    const [n] = apply(s, (d) => engine.sleep(d));
    expect(n.energy).toBeLessThan(15);
    const night = produce(at(createNewGame(5), dayStart(1) + 23 * 60), (d) => void (d.energy = 10));
    expect(apply(night, (d) => engine.sleep(d))[0].energy).toBe(BALANCE.maxEnergy);
  });
});

describe('chat hint is noisy', () => {
  it('empty segments regularly show more chat than segments with moments', () => {
    let emptyHigh = 0, empties = 0, momentLow = 0, moments = 0;
    for (const st of STREAMERS)
      for (let day = 1; day <= 10; day++) {
        const sess = generateSession(3, st, day);
        for (const seg of sess.segments) {
          const v = estimateChat(sess.key, seg, 1);
          if (seg.momentIds.length === 0) {
            empties++;
            if (v > 0.45) emptyHigh++;
          } else {
            moments++;
            if (v < 0.45) momentLow++;
          }
        }
      }
    expect(emptyHigh / empties).toBeGreaterThan(0.1);
    expect(momentLow / moments).toBeGreaterThan(0.1);
  });

  it('moment subjects do not repeat within a stream while fresh material remains', () => {
    for (const st of STREAMERS)
      for (let day = 1; day <= 5; day++) {
        const subjects = Object.values(generateSession(9, st, day).moments).map((m) => m.subject);
        expect(new Set(subjects).size).toBe(subjects.length);
      }
  });

  it('trend boards are deterministic', () => {
    expect(generateTrends(4, 2)).toEqual(generateTrends(4, 2));
  });
});

describe('ledger', () => {
  it('keeps exact amounts merged per day and label, and never evicts the opening balance', () => {
    const base = createNewGame(8);
    const m = Object.values(generateSession(8, STREAMERS[0]!, 1).moments)[0]!;
    const clip = (platform: 'blink' | 'chirp', id: string) => ({
      id, draftId: id, platform, streamerId: m.streamerId, category: m.category, title: 't', thumbnail: 'action' as const, quality: 60,
      lengthSec: 20, publishedAtMinute: base.minute, factors: { quality: 1, platformFit: 1, audienceFit: 1, trend: 1, competition: 1, originality: 1, reputation: 1, streamerPull: 1, luck: 1, viral: false },
      targetViews: 400000, tau: 600, likeRate: 0.05, commentRate: 0.01, shareRate: 0.01, followRate: 0.01,
      views: 0, likes: 0, comments: 0, shares: 0, followersGained: 0, revenue: 0, history: [],
    });
    let s = produce(base, (d) => {
      d.platforms.blink.monetized = true;
      d.published.push(clip('blink', 'a'), clip('chirp', 'b'));
    });
    s = produce(s, (d) => void engine.advanceTime(d, 20 * 24 * 60));
    expect(s.ledger[0]!.label).toBe('Savings');
    const revenue = s.platforms.blink.revenue + s.platforms.chirp.revenue;
    const logged = s.ledger.filter((l) => l.kind === 'income' && l.label !== 'Savings').reduce((a, l) => a + l.amount, 0);
    expect(logged).toBeCloseTo(revenue, 2);
    expect(s.ledger.length).toBeLessThan(BALANCE.ledgerCap);
  });
});

describe('editing', () => {
  const draftOf = (m: StreamMoment, over: Partial<ClipDraft> = {}): ClipDraft => ({
    id: 'd', moment: m, createdAtMinute: 0, trimStart: 0, trimEnd: m.rawLength, title: 'x', titleStyle: 'descriptive', hook: 'none',
    subtitles: 'basic', effects: [], thumbnail: 'action', status: 'editing', quality: null, ...over,
  });
  const allMoments = STREAMERS.flatMap((st) => [1, 2, 3, 4].flatMap((d) => Object.values(generateSession(21, st, d).moments)));
  const ctx = (name = 'X') => ({ editingLevel: 1, maxEffects: 2, streamerName: name });

  it('title style is inferred from the text; gibberish scores badly', () => {
    expect(inferTitleStyle('"Every day ends."')).toBe('quote');
    expect(inferTitleStyle('Did that just happen?')).toBe('question');
    expect(inferTitleStyle('HE COMPLETELY LOSES IT')).toBe('hype');
    const m = allMoments[0]!;
    const name = getStreamer(m.streamerId).name;
    const good = computeQuality(draftOf(m, { title: `${name} ${m.subject}` }), ctx(name)).parts.find((p) => p.id === 'title')!.score;
    const mash = computeQuality(draftOf(m, { title: `${name} qwrtpsdfghjkl zxcvbnm` }), ctx(name)).parts.find((p) => p.id === 'title')!.score;
    expect(good).toBeGreaterThan(mash + 30);
  });

  it('updateDraft derives the style from the title and ignores a forced style label', () => {
    const { s, momentId } = scanUntilMoment(createNewGame(2), 'novalive');
    let [n] = apply(s, (d) => engine.startDraft(d, 'novalive', 1, momentId, 'dd'));
    [n] = apply(n, (d) => engine.updateDraft(d, 'dd', { title: 'What just happened?', titleStyle: 'quote' }));
    expect(n.drafts[0]!.titleStyle).toBe('question');
  });

  it('long-form moments can still get a near-perfect cut', () => {
    const m = allMoments.find(
      (x) => x.category === 'emotional' && x.beatAt >= Math.round(x.idealLength * 0.4) && x.rawLength >= x.beatAt - Math.round(x.idealLength * 0.4) + x.idealLength,
    )!;
    const start = m.beatAt - Math.round(m.idealLength * 0.4);
    const d = draftOf(m, { trimStart: start, trimEnd: Math.min(m.rawLength, start + m.idealLength) });
    expect(computeQuality(d, ctx()).parts.find((p) => p.id === 'trim')!.score).toBeGreaterThanOrEqual(90);
  });

  it('the best hook differs between moments of the same category', () => {
    const funny = allMoments.filter((m) => m.category === 'funny');
    const best = new Set(
      funny.map((m) => (['cold-open', 'text-teaser', 'countdown', 'none'] as const).reduce((a, h) => (momentTaste(m.id, 'hook', h) + 0 > momentTaste(m.id, 'hook', a) ? h : a))),
    );
    expect(best.size).toBeGreaterThan(1);
  });

  it('re-rendering a draft does not farm XP', () => {
    let s = readyDraft(createNewGame(6), 'novalive', 'r1');
    const xp = s.skills.editing.xp + s.skills.editing.level * 1000;
    for (let i = 0; i < 3; i++) {
      s = apply(s, (d) => engine.reopenDraft(d, 'r1'))[0];
      s = produce(s, (d) => void (d.energy = 100));
      s = apply(s, (d) => engine.finishDraft(d, 'r1'))[0];
    }
    expect(s.skills.editing.xp + s.skills.editing.level * 1000).toBe(xp);
  });
});

describe('publishing', () => {
  it('luck is fixed per draft, regardless of publish order', () => {
    let s = createNewGame(13);
    s = readyDraft(s, 'novalive', 'A');
    s = produce(s, (d) => void (d.energy = 100));
    s = readyDraft(s, 'novalive', 'B');
    const ab = apply(apply(s, (d) => engine.publishClip(d, 'A', 'chirp', 'ca'))[0], (d) => engine.publishClip(d, 'B', 'chirp', 'cb'))[0];
    const ba = apply(apply(s, (d) => engine.publishClip(d, 'B', 'chirp', 'cb'))[0], (d) => engine.publishClip(d, 'A', 'chirp', 'ca'))[0];
    const luck = (g: GameState) => g.published.find((c) => c.id === 'ca')!.factors.luck;
    expect(luck(ab)).toBe(luck(ba));
  });

  it('same-category clips on one platform tire the audience; published drafts are dropped', () => {
    let s = createNewGame(13);
    s = readyDraft(s, 'novalive', 'A');
    const [p1] = apply(s, (d) => engine.publishClip(d, 'A', 'blink', 'c1'));
    expect(p1.drafts.find((d) => d.id === 'A')).toBeUndefined();
    expect(engine.recentSameCategory(p1, 'blink', p1.published[0]!.category)).toBe(1);
  });

  it('reputation settles from performance once, then decays daily', () => {
    let s = readyDraft(createNewGame(13), 'novalive', 'A');
    s = apply(s, (d) => engine.publishClip(d, 'A', 'chirp', 'c1'))[0];
    s = produce(s, (d) => void engine.advanceTime(d, 5 * 24 * 60));
    expect(s.published[0]!.repApplied).toBe(true);
    const r = s.reputation;
    s = produce(s, (d) => {
      d.reputation = 50;
      engine.advanceTime(d, 24 * 60);
    });
    expect(s.reputation).toBeLessThan(50);
    expect(Number.isFinite(r)).toBe(true);
  });
});

describe('save robustness', () => {
  it('drops drafts and clips with corrupted nested data instead of crashing later', () => {
    const g = createNewGame(5) as unknown as Record<string, unknown>;
    const badDraft = { id: 'x', status: 'editing', trimStart: 0, trimEnd: 10, title: 't', moment: { id: 'm', streamerId: 'nobody' } };
    const badClip = { id: 'c', platform: 'blink', streamerId: 'ghost', category: 'funny', targetViews: 5, tau: 10, publishedAtMinute: 0, views: 0, history: [] };
    const nanClip = { id: 'n', platform: 'blink', streamerId: 'novalive', category: 'funny', targetViews: 50, tau: 10, publishedAtMinute: 0, views: 0, history: [], followRate: 'x', likes: null };
    const v = validateSave({ ...g, drafts: [badDraft], published: [badClip, nanClip] });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.state.drafts).toHaveLength(0);
    expect(v.state.published).toHaveLength(1);
    expect(Number.isFinite(v.state.published[0]!.followRate)).toBe(true);
    expect(v.repaired.length).toBeGreaterThan(0);
    expect(findNonFinite(v.state)).toBeNull();
  });

  it('refuses to save a state containing NaN', async () => {
    const sys = new SaveSystem(new (await import('fake-indexeddb')).IDBFactory());
    const g = produce(createNewGame(1), (d) => void (d.cash = Number.NaN));
    await expect(sys.save('slot1', g)).rejects.toThrow(/invalid number/);
  });

  it('rejects envelopes from a newer game version', async () => {
    const sys = new SaveSystem(new (await import('fake-indexeddb')).IDBFactory());
    await sys.writeRaw('slot1', { version: 99, savedAt: 1, state: createNewGame(1) });
    expect((await sys.load('slot1')).ok).toBe(false);
  });
});

describe('store behaviour', () => {
  const S = () => useGame.getState();
  beforeEach(() => S().newGame(77));
  afterEach(() => vi.restoreAllMocks());

  it('the clock freezes while the menu is open', () => {
    const m = S().game!.minute;
    S().openModal('menu');
    S().tick(5000);
    expect(S().game!.minute).toBe(m);
    S().openModal(null);
    S().tick(5000);
    expect(S().game!.minute).toBeGreaterThan(m);
  });

  it('P-style toggle resumes at the previous speed', () => {
    S().setSpeed(3);
    S().togglePause();
    expect(S().ui.speed).toBe(0);
    S().togglePause();
    expect(S().ui.speed).toBe(3);
  });

  it('a throwing reducer is contained instead of escaping the store', () => {
    // A null clip makes advanceTime throw: the tick must pause instead of crashing every frame.
    useGame.setState({ game: produce(S().game!, (d) => void d.published.push(null as never)) });
    S().setSpeed(1);
    expect(() => S().tick(5000)).not.toThrow();
    expect(S().ui.speed).toBe(0);
    expect(() => S().scan('novalive', 0)).not.toThrow();
  });

  it('quit keeps the game when the save fails', async () => {
    vi.spyOn(saveSystem, 'save').mockRejectedValue(new Error('disk full'));
    expect(await S().quitToTitle()).toBe(false);
    expect(S().game).not.toBeNull();
    expect(await S().quitToTitle(true)).toBe(true);
    expect(S().game).toBeNull();
  });

  it('manual slots load as snapshots without offline progress', async () => {
    await S().saveSlot('slot2', true);
    const m = S().game!.minute;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000);
    expect(await S().loadSlot('slot2')).toBe(true);
    expect(S().game!.minute).toBe(m);
  });

  it('publishing does not auto-select another clip', () => {
    const g = readyDraft(readyDraft(S().game!, 'novalive', 'p1'), 'novalive', 'p2');
    useGame.setState({ game: produce(g, (d) => void (d.energy = 100)) });
    S().setPublishDraft('p1');
    expect(S().publish('p1', 'chirp')).toBe(true);
    expect(S().ui.publishDraftId).toBeNull();
    expect(S().ui.lastPublishedClipId).not.toBeNull();
    expect(S().publish('p1', 'chirp')).toBe(false); // a second click can't republish
  });
});
