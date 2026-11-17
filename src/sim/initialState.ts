import { BALANCE } from '../data/balance';
import { PLATFORMS } from '../data/platforms';
import type { GameState, ObjectiveId, PlatformAccount, PlatformId, SkillId } from '../types/game';

export const SAVE_VERSION = 2;

export const OBJECTIVE_ORDER: { id: ObjectiveId; label: string }[] = [
  { id: 'open-computer', label: 'Click your computer (or walk over and press E)' },
  { id: 'pick-streamer', label: 'Pick a streamer who is live' },
  { id: 'scan-stream', label: 'Scan an aired segment of their stream' },
  { id: 'select-moment', label: 'Select a moment worth clipping' },
  { id: 'finish-edit', label: 'Edit the clip and finish it' },
  { id: 'publish', label: 'Publish it on a platform' },
  { id: 'check-analytics', label: 'Check your Analytics' },
  { id: 'save-game', label: 'Save your game (Menu → Save)' },
];

const account = (id: PlatformId): PlatformAccount => {
  const open = PLATFORMS[id].monetization.minFollowers === 0 && PLATFORMS[id].monetization.minTotalViews === 0;
  return { followers: 0, totalViews: 0, monetized: open, monetizedAtMinute: open ? BALANCE.startMinute : null, revenue: 0 };
};
const skill = () => ({ level: 1, xp: 0 });

export function createNewGame(seed: number = Math.floor(Math.random() * 2 ** 31)): GameState {
  const skills: Record<SkillId, { level: number; xp: number }> = {
    editing: skill(),
    trendSense: skill(),
    marketing: skill(),
    management: skill(),
    networking: skill(),
  };
  const objectives = Object.fromEntries(OBJECTIVE_ORDER.map((o) => [o.id, false])) as Record<ObjectiveId, boolean>;
  return {
    version: SAVE_VERSION,
    worldSeed: seed,
    rngState: seed ^ 0x5bd1e995,
    minute: BALANCE.startMinute,
    cash: BALANCE.startingCash,
    rentOwed: 0,
    missedRent: 0,
    gameOver: null,
    reputation: 0,
    energy: BALANCE.maxEnergy,
    drinksToday: 0,
    lastPetMinute: -9999,
    xp: 0,
    level: 1,
    skills,
    platforms: { blink: account('blink'), tubely: account('tubely'), chirp: account('chirp') },
    scanned: {},
    usedMomentIds: [],
    drafts: [],
    published: [],
    ledger: [{ minute: BALANCE.startMinute, amount: BALANCE.startingCash, label: 'Savings', kind: 'income' }],
    daily: [{ day: 1, views: 0, followers: 0, revenue: 0, expenses: 0, clipsPublished: 0 }],
    employees: [],
    office: 'bedroom',
    equipment: ['basic-laptop'],
    objectives,
    stats: { clipsEdited: 0, clipsPublished: 0, viralClips: 0, segmentsScanned: 0 },
    createdAt: Date.now(),
  };
}
