// End-to-end first-day loop driven through the real Zustand store (no rendering).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getStreamer, STREAMERS } from '../src/data/streamers';
import { totalFollowers } from '../src/sim/engine';
import { getSession, segmentAired } from '../src/sim/streams';
import { dayOf } from '../src/sim/time';
import { useGame } from '../src/state/store';

const S = () => useGame.getState();

describe('first day gameplay loop', () => {
  beforeEach(() => {
    S().newGame(2024);
  });

  it('new game starts with the specified initial state', () => {
    const g = S().game!;
    expect(g.cash).toBe(250);
    expect(totalFollowers(g)).toBe(0);
    expect(g.employees).toHaveLength(0);
    expect(g.equipment).toEqual(['basic-laptop']);
    expect(g.office).toBe('bedroom');
    expect(g.reputation).toBe(0);
  });

  it('discover → select → edit → publish → earn → analytics → save → reload', async () => {
    S().openPanel('streams');
    // Find a streamer with an aired segment that contains a moment.
    let found: { streamerId: string; seg: number; momentId: string } | null = null;
    for (let tries = 0; tries < 40 && !found; tries++) {
      const g = S().game!;
      for (const st of STREAMERS) {
        const sess = getSession(g.worldSeed, st, dayOf(g.minute));
        const scanned = g.scanned[sess.key] ?? [];
        const seg = sess.segments.find((x) => segmentAired(x, g.minute) && !scanned.includes(x.index));
        if (!seg) continue;
        S().selectStreamer(st.id);
        expect(S().scan(st.id, seg.index)).toBe(true);
        if (seg.momentIds.length) {
          found = { streamerId: st.id, seg: seg.index, momentId: seg.momentIds[0]! };
          break;
        }
      }
      if (!found) S().tick(30 * 250); // wait for more stream to air
    }
    expect(found).not.toBeNull();
    const { streamerId, momentId } = found!;

    expect(S().selectMoment(streamerId, dayOf(S().game!.minute), momentId)).toBe(true);
    const draftId = S().ui.activeDraftId!;
    const draft = S().game!.drafts.find((d) => d.id === draftId)!;
    const m = draft.moment;
    S().updateDraft(draftId, {
      trimStart: Math.max(0, m.beatAt - 6),
      trimEnd: Math.min(m.rawLength, m.beatAt + 5),
      subtitles: 'bold-pop',
      hook: 'cold-open',
      thumbnail: 'reaction',
      effects: ['zoom-punch'],
    });
    expect(S().finishDraft(draftId)).toBe(true);
    const q = S().game!.drafts.find((d) => d.id === draftId)!.quality!;
    expect(q).toBeGreaterThan(30);

    const cashBefore = S().game!.cash;
    expect(S().publish(draftId, 'chirp')).toBe(true);
    const clip = S().game!.published[0]!;
    expect(clip.platform).toBe('chirp');
    expect(getStreamer(clip.streamerId).id).toBe(streamerId);

    // Let 6 game hours pass at 3x.
    S().setSpeed(3);
    for (let i = 0; i < 60; i++) S().tick(2000);
    const g = S().game!;
    const after = g.published[0]!;
    expect(after.views).toBeGreaterThan(0);
    expect(after.likes).toBeGreaterThan(0);
    expect(totalFollowers(g)).toBeGreaterThan(0);
    expect(g.cash).toBeGreaterThan(cashBefore - 1); // chirp is monetized from day one
    expect(after.revenue).toBeGreaterThan(0);

    S().openPanel('analytics');
    expect(S().game!.objectives['check-analytics']).toBe(true);

    expect(await S().saveSlot('slot1')).toBe(true);
    const snapshot = S().game!;
    expect(await S().quitToTitle()).toBe(true);
    expect(S().game).toBeNull();
    expect(await S().loadSlot('slot1')).toBe(true);
    const loaded = S().game!;
    expect(loaded.published[0]!.id).toBe(snapshot.published[0]!.id);
    expect(loaded.cash).toBeGreaterThanOrEqual(snapshot.cash);
    expect(loaded.objectives['save-game']).toBe(true);
  });
});
