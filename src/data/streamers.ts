import type { Streamer } from '../types/game';

// All streamers are fictional. Any resemblance to real creators is coincidental.
export const STREAMERS: Streamer[] = [
  {
    id: 'pixelrage',
    name: 'PixelRage',
    category: 'gaming',
    tagline: 'Speedruns retro platformers. Loses composure roughly every 11 minutes.',
    traits: ['Explosive temper', 'Elite reflexes', 'Loyal teen audience'],
    popularity: 62,
    audience: { teens: 0.55, youngAdults: 0.35, adults: 0.1 },
    momentWeights: { funny: 2, rage: 4, emotional: 0.5, unexpected: 2, controversial: 0.6, gameplay: 3, quote: 1 },
    volatility: 0.55,
    schedule: { startHour: 14, durationHours: 8 },
    portrait: { skin: '#e3a577', hair: '#d6384e', shirt: '#1f1b2e', accent: '#ff5470', hairStyle: 'spiky', headset: true },
  },
  {
    id: 'dailymic',
    name: 'The Daily Mic',
    category: 'podcast',
    tagline: 'Two hosts, one table, strong opinions about everything before noon.',
    traits: ['Hot takes', 'Great guests', 'Older, loyal listeners'],
    popularity: 48,
    audience: { teens: 0.1, youngAdults: 0.4, adults: 0.5 },
    momentWeights: { funny: 2, rage: 0.6, emotional: 1.5, unexpected: 1, controversial: 3, gameplay: 0, quote: 4 },
    volatility: 0.45,
    schedule: { startHour: 8, durationHours: 4 },
    portrait: { skin: '#a8714f', hair: '#2b1f1a', shirt: '#3c5a99', accent: '#f2c14e', hairStyle: 'short', glasses: true },
  },
  {
    id: 'novalive',
    name: 'NovaLive',
    category: 'irl',
    tagline: 'Walks through cities with a camera and zero plan. Chaos follows.',
    traits: ['Unpredictable', 'Wholesome encounters', 'Broad audience'],
    popularity: 55,
    audience: { teens: 0.3, youngAdults: 0.45, adults: 0.25 },
    momentWeights: { funny: 2.5, rage: 0.5, emotional: 2.5, unexpected: 4, controversial: 1, gameplay: 0, quote: 1 },
    volatility: 0.6,
    schedule: { startHour: 9, durationHours: 6 },
    portrait: { skin: '#f1c9a5', hair: '#7a4cd9', shirt: '#2ec4b6', accent: '#ffffff', hairStyle: 'long' },
  },
  {
    id: 'chaosking',
    name: 'ChaosKing',
    category: 'gaming',
    tagline: 'Plays anything with friends. Proudly bad at all of it.',
    traits: ['Huge reach', 'Crowded clip scene', 'Late-night streams'],
    popularity: 80,
    audience: { teens: 0.45, youngAdults: 0.45, adults: 0.1 },
    momentWeights: { funny: 4, rage: 2, emotional: 0.5, unexpected: 3, controversial: 1.5, gameplay: 1.5, quote: 1 },
    volatility: 0.65,
    schedule: { startHour: 18, durationHours: 6 },
    portrait: { skin: '#c68a5e', hair: '#f2c14e', shirt: '#6b2fa3', accent: '#f2c14e', hairStyle: 'cap' },
  },
  {
    id: 'chillcast',
    name: 'ChillCast',
    category: 'podcast',
    tagline: 'Slow, cozy conversations about life, food and late-night thoughts.',
    traits: ['Heartfelt stories', 'Low competition', 'Calm audience'],
    popularity: 35,
    audience: { teens: 0.15, youngAdults: 0.5, adults: 0.35 },
    momentWeights: { funny: 1.5, rage: 0.2, emotional: 4, unexpected: 1, controversial: 0.8, gameplay: 0, quote: 3 },
    volatility: 0.35,
    schedule: { startHour: 12, durationHours: 4 },
    portrait: { skin: '#8d5a3b', hair: '#1a1a24', shirt: '#e98a5b', accent: '#7ee0c8', hairStyle: 'bun' },
  },
];

export const STREAMER_BY_ID: Record<string, Streamer> = Object.fromEntries(STREAMERS.map((s) => [s.id, s]));

export function getStreamer(id: string): Streamer {
  const s = STREAMER_BY_ID[id];
  if (!s) throw new Error(`Unknown streamer: ${id}`);
  return s;
}

const UNKNOWN: Streamer = {
  id: 'unknown',
  name: 'Unknown streamer',
  category: 'gaming',
  tagline: '',
  traits: [],
  popularity: 30,
  audience: { teens: 0.33, youngAdults: 0.34, adults: 0.33 },
  momentWeights: { funny: 1, rage: 1, emotional: 1, unexpected: 1, controversial: 1, gameplay: 1, quote: 1 },
  volatility: 0.4,
  schedule: { startHour: 0, durationHours: 0 },
  portrait: { skin: '#c68a5e', hair: '#333344', shirt: '#444466', accent: '#888899', hairStyle: 'short' },
};

/** Non-throwing lookup for UI code: unknown ids render as a placeholder instead of crashing. */
export const findStreamer = (id: string): Streamer => STREAMER_BY_ID[id] ?? UNKNOWN;
