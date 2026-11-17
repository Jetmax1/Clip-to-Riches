import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { PLATFORMS } from '../src/data/platforms';
import { getStreamer, STREAMERS } from '../src/data/streamers';
import * as engine from '../src/sim/engine';
import { createNewGame } from '../src/sim/initialState';
import { monetizationEligible, simulatePublish, viewsAt } from '../src/sim/publishing';
import { computeQuality } from '../src/sim/quality';
import { Rng } from '../src/sim/rng';
import { estimateMoment, generateSession, generateTrends, getSession, segmentAired } from '../src/sim/streams';
import { dayOf, minutesUntilWake } from '../src/sim/time';
import type { ActionResult, ClipDraft, GameState, StreamMoment } from '../src/types/game';

const apply = (s: GameState, fn: (d: GameState) => ActionResult): [GameState, ActionResult] => {
  let r: ActionResult = { ok: false, reason: '' };
  const next = produce(s, (d) => {
    r = fn(d);
  });
  return [next, r];
};

function anyMoment(seed = 42): StreamMoment {
  for (const st of STREAMERS) {
    const sess = generateSession(seed, st, 1);
    const m = Object.values(sess.moments)[0];
    if (m) return m;
  }
  throw new Error('no moments');
}

function draftFor(m: StreamMoment, over: Partial<ClipDraft> = {}): ClipDraft {
  return {
    id: 'd1',
    moment: m,
    createdAtMinute: m.airMinute,
    trimStart: 0,
    trimEnd: m.rawLength,
    title: 'A decent title for this clip',
    titleStyle: 'descriptive',
    hook: 'none',
    subtitles: 'none',
    effects: [],
    thumbnail: 'action',
    status: 'editing',
    quality: null,
    ...over,
  };
}

describe('rng & generation', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(123), b = new Rng(123);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('generates identical sessions for identical inputs and different ones for different days', () => {
    const s = STREAMERS[0]!;
    expect(generateSession(7, s, 1)).toEqual(generateSession(7, s, 1));
    expect(JSON.stringify(generateSession(7, s, 1).moments)).not.toEqual(JSON.stringify(generateSession(7, s, 2).moments));
  });

  it('every streamer produces multiple moments with valid hidden attributes', () => {
    for (const st of STREAMERS) {
      const sess = generateSession(99, st, 1);
      const moments = Object.values(sess.moments);
      expect(moments.length).toBeGreaterThan(2);
      for (const m of moments) {
        for (const v of Object.values(m.hidden)) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
        expect(m.beatAt).toBeGreaterThan(0);
        expect(m.beatAt).toBeLessThan(m.rawLength);
        expect(m.intensity.length).toBe(Math.ceil(m.rawLength / 5));
      }
    }
  });

  it('trend sense narrows estimate error', () => {
    let errLow = 0, errHigh = 0, n = 0;
    for (const st of STREAMERS)
      for (let d = 1; d <= 6; d++)
        for (const m of Object.values(generateSession(5, st, d).moments)) {
          const truth = 1 + Math.round((0.65 * m.hidden.virality + 0.35 * m.hidden.relevance) * 4);
          errLow += Math.abs(estimateMoment(m, m.airMinute, 1).hypeStars - truth);
          errHigh += Math.abs(estimateMoment(m, m.airMinute, 8).hypeStars - truth);
          n++;
        }
    expect(n).toBeGreaterThan(50);
    expect(errHigh).toBeLessThan(errLow);
  });

  it('trend board has hot and cold categories per platform', () => {
    const t = generateTrends(1, 1);
    for (const row of Object.values(t)) {
      expect(Math.max(...Object.values(row))).toBeGreaterThan(1.2);
      expect(Math.min(...Object.values(row))).toBeLessThan(0.85);
    }
  });
});

describe('clip quality', () => {
  const ctx = { editingLevel: 1, maxEffects: 2, streamerName: 'X' };

  it('cutting out the key beat tanks the cut score', () => {
    const m = anyMoment();
    const good = computeQuality(draftFor(m, { trimStart: Math.max(0, m.beatAt - 6), trimEnd: Math.min(m.rawLength, m.beatAt + 6) }), ctx);
    const bad = computeQuality(draftFor(m, { trimStart: m.beatAt + 2, trimEnd: Math.min(m.rawLength, m.beatAt + 20) }), ctx);
    expect(good.parts.find((p) => p.id === 'trim')!.score).toBeGreaterThan(60);
    expect(bad.parts.find((p) => p.id === 'trim')!.score).toBeLessThan(10);
    expect(good.total).toBeGreaterThan(bad.total);
  });

  it('player skill raises quality', () => {
    const d = draftFor(anyMoment());
    expect(computeQuality(d, { ...ctx, editingLevel: 5 }).total).toBeGreaterThan(computeQuality(d, ctx).total);
  });

  it('validates invalid choices', () => {
    const m = anyMoment();
    expect(computeQuality(draftFor(m, { title: '' }), ctx).valid).toBe(false);
    expect(computeQuality(draftFor(m, { effects: ['zoom-punch', 'sound-fx', 'slow-mo'] }), ctx).valid).toBe(false);
    expect(computeQuality(draftFor(m, { subtitles: 'karaoke' }), ctx).valid).toBe(false);
    expect(computeQuality(draftFor(m, { subtitles: 'karaoke' }), { ...ctx, editingLevel: 2 }).valid).toBe(true);
  });
});

describe('publishing & economy', () => {
  const m = anyMoment();
  const streamer = getStreamer(m.streamerId);
  const base = createNewGame(1);
  const publishOn = (platform: 'blink' | 'tubely' | 'chirp', quality: number, seed: number) =>
    simulatePublish({
      id: 'c',
      draft: draftFor(m, { trimStart: Math.max(0, m.beatAt - 5), trimEnd: Math.min(m.rawLength, m.beatAt + 5), status: 'ready' }),
      quality,
      platform,
      streamer,
      account: base.platforms[platform],
      reputation: 0,
      trends: generateTrends(1, 1),
      now: m.airMinute + 30,
      rng: new Rng(seed),
    });

  it('higher quality yields more views on average', () => {
    let lo = 0, hi = 0;
    for (let i = 0; i < 300; i++) {
      lo += publishOn('tubely', 30, i).targetViews;
      hi += publishOn('tubely', 85, i).targetViews;
    }
    expect(hi).toBeGreaterThan(lo * 2);
  });

  it('virality is possible but not guaranteed', () => {
    let viral = 0;
    for (let i = 0; i < 2000; i++) if (publishOn('blink', 80, i).factors.viral) viral++;
    expect(viral).toBeGreaterThan(0);
    expect(viral).toBeLessThan(400);
  });

  it('views grow monotonically and approach the target', () => {
    const c = publishOn('blink', 70, 3);
    let prev = -1;
    for (let t = 0; t <= c.tau * 6; t += 15) {
      const v = viewsAt(c, c.publishedAtMinute + t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(prev).toBeGreaterThan(c.targetViews * 0.99);
  });

  it('views only become money on monetized platforms', () => {
    let s = createNewGame(1);
    const clip = (platform: 'blink' | 'chirp') => ({ ...publishOn(platform, 70, 5), id: platform, platform, publishedAtMinute: s.minute, history: [] });
    s = produce(s, (d) => {
      d.published.push(clip('blink'), clip('chirp'));
    });
    s = produce(s, (d) => void engine.advanceTime(d, 60));
    const blink = s.published.find((c) => c.platform === 'blink')!;
    const chirp = s.published.find((c) => c.platform === 'chirp')!;
    expect(blink.views).toBeGreaterThan(0);
    // Blink starts unmonetized; any revenue there can only come after unlocking.
    if (!s.platforms.blink.monetized) expect(blink.revenue).toBe(0);
    expect(s.platforms.chirp.monetized).toBe(true);
    expect(chirp.revenue).toBeCloseTo((chirp.views * PLATFORMS.chirp.monetization.rpm) / 1000, 2);
    expect(s.cash).toBeGreaterThan(BALANCE.startingCash);
  });

  it('monetization eligibility follows platform rules', () => {
    const min = PLATFORMS.blink.monetization.minFollowers;
    const a = { followers: min - 1, totalViews: 0, monetized: false, monetizedAtMinute: null, revenue: 0 };
    expect(monetizationEligible(a, PLATFORMS.blink)).toBe(false);
    expect(monetizationEligible({ ...a, followers: min }, PLATFORMS.blink)).toBe(true);
    expect(monetizationEligible({ ...a, followers: 500, totalViews: 100 }, PLATFORMS.tubely)).toBe(false);
    expect(monetizationEligible(a, PLATFORMS.chirp)).toBe(true);
  });

  it('rent never drives cash negative; shortfall becomes debt paid from earnings', () => {
    let s = produce(createNewGame(1), (d) => {
      d.cash = 10;
    });
    s = produce(s, (d) => void engine.advanceTime(d, 7 * 24 * 60));
    expect(dayOf(s.minute)).toBe(8);
    expect(s.cash).toBe(0);
    expect(s.rentOwed).toBe(BALANCE.rent.amount - 10 + BALANCE.rent.lateFee);
    expect(s.missedRent).toBe(1);
  });
});

describe('actions', () => {
  it('cannot scan a segment that has not aired, and a failed action changes nothing', () => {
    const s = createNewGame(3);
    const pixel = getSession(s.worldSeed, getStreamer('pixelrage'), 1); // starts 14:00
    expect(segmentAired(pixel.segments[0]!, s.minute)).toBe(false);
    const [next, r] = apply(s, (d) => engine.scanSegment(d, 'pixelrage', 0));
    expect(r.ok).toBe(false);
    expect(next).toBe(s);
  });

  it('sleep wakes at 08:00 with full energy', () => {
    const s = produce(createNewGame(3), (d) => {
      d.energy = 5;
    });
    const mins = minutesUntilWake(s.minute);
    const [next, r] = apply(s, (d) => engine.sleep(d));
    expect(r.ok).toBe(true);
    expect(next.minute).toBe(s.minute + mins);
    expect(next.minute % 1440).toBe(8 * 60);
    expect(next.energy).toBe(BALANCE.maxEnergy);
  });

  it('drops scan records for past days at day rollover', () => {
    let s = produce(createNewGame(3), (d) => {
      d.scanned['novalive:d1'] = [0, 1];
    });
    s = produce(s, (d) => void engine.advanceTime(d, 24 * 60));
    expect(s.scanned['novalive:d1']).toBeUndefined();
  });

  it('energy drinks cost money and are capped per day', () => {
    let s = produce(createNewGame(3), (d) => {
      d.energy = 10;
    });
    for (let i = 0; i < BALANCE.drink.maxPerDay; i++) {
      const [n, r] = apply(s, (d) => engine.buyDrink(d));
      expect(r.ok).toBe(true);
      s = n;
    }
    expect(apply(s, (d) => engine.buyDrink(d))[1].ok).toBe(false);
    const spent = [0, 1, 2].reduce((a, n) => a + engine.drinkPrice(n), 0);
    expect(s.cash).toBeCloseTo(BALANCE.startingCash - spent, 4);
    expect(engine.drinkPrice(2)).toBeGreaterThan(engine.drinkPrice(0));
  });
});
