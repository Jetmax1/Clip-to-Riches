// Stream & moment generation. Pure and deterministic: (worldSeed, streamer, day) -> session.

import { BALANCE } from '../data/balance';
import { HYPE_TITLES, MOMENT_BANK, QUESTION_TITLES } from '../data/momentTemplates';
import { PLATFORM_IDS } from '../data/platforms';
import { STREAMERS } from '../data/streamers';
import { MOMENT_CATEGORIES } from '../data/editorOptions';
import type {
  MomentCategory,
  PlatformId,
  Streamer,
  StreamMoment,
  StreamSegment,
  StreamSession,
  TitleStyle,
} from '../types/game';
import { clamp01, hashString, Rng, seeded } from './rng';
import { dayStart } from './time';

const IDEAL_LENGTH: Record<MomentCategory, number> = {
  funny: 20,
  rage: 24,
  emotional: 42,
  unexpected: 22,
  controversial: 34,
  gameplay: 30,
  quote: 18,
};

export const sessionKey = (streamerId: string, day: number): string => `${streamerId}:d${day}`;

const cache = new Map<string, StreamSession>();

export function getSession(worldSeed: number, streamer: Streamer, day: number): StreamSession {
  const key = `${worldSeed}|${sessionKey(streamer.id, day)}`;
  let s = cache.get(key);
  if (!s) {
    s = generateSession(worldSeed, streamer, day);
    if (cache.size > 200) cache.clear();
    cache.set(key, s);
  }
  return s;
}

export function generateSession(worldSeed: number, streamer: Streamer, day: number): StreamSession {
  const rng = seeded(worldSeed, streamer.id, day);
  const startMinute = dayStart(day) + streamer.schedule.startHour * 60;
  const endMinute = startMinute + streamer.schedule.durationHours * 60;
  const segCount = Math.round((endMinute - startMinute) / BALANCE.segmentMinutes);
  const bank = MOMENT_BANK[streamer.category];
  const usedTemplates = new Set<string>();
  const segments: StreamSegment[] = [];
  const moments: Record<string, StreamMoment> = {};

  for (let i = 0; i < segCount; i++) {
    const segStart = startMinute + i * BALANCE.segmentMinutes;
    const roll = rng.next();
    const count = roll < 0.3 ? 0 : roll < 0.8 ? 1 : 2;
    const ids: string[] = [];
    let peak = 0;
    for (let m = 0; m < count; m++) {
      const moment = makeMoment(rng, streamer, day, i, segStart, bank, usedTemplates, m);
      moments[moment.id] = moment;
      ids.push(moment.id);
      peak = Math.max(peak, moment.hidden.virality);
    }
    // Chat is a weak, noisy signal: empty half-hours often get hyped over nothing
    // (giveaways, drama in chat), and real moments can pass quietly. The noise the
    // player sees on top of this is added in estimateChat() and shrinks with Trend Sense.
    const baseline = rng.range(0.15, 0.55);
    const activity = count === 0 ? baseline : 0.25 + 0.25 * peak + rng.range(0, 0.3);
    segments.push({
      index: i,
      startMinute: segStart,
      endMinute: segStart + BALANCE.segmentMinutes,
      chatActivity: clamp01(activity),
      momentIds: ids,
    });
  }

  return { key: sessionKey(streamer.id, day), streamerId: streamer.id, day, startMinute, endMinute, segments, moments };
}

function makeMoment(
  rng: Rng,
  streamer: Streamer,
  day: number,
  segIndex: number,
  segStart: number,
  bank: Record<MomentCategory, { description: string; subject: string; quote: string }[]>,
  used: Set<string>,
  n: number,
): StreamMoment {
  let category = rng.weighted(streamer.momentWeights);
  const fresh = (c: MomentCategory) => bank[c].filter((t) => !used.has(t.subject));
  if (fresh(category).length === 0) {
    // This category's material is used up today: switch to another category that still
    // has unused subjects (weighted by the streamer's tastes) instead of repeating one.
    const weights = Object.fromEntries(
      (Object.keys(streamer.momentWeights) as MomentCategory[]).map((c) => [c, fresh(c).length > 0 ? streamer.momentWeights[c] + 0.05 : 0]),
    ) as Record<MomentCategory, number>;
    if (Object.values(weights).some((w) => w > 0)) category = rng.weighted(weights);
  }
  if (bank[category].length === 0) category = 'funny';
  const pool = fresh(category);
  const template = pool.length > 0 ? rng.pick(pool) : rng.pick(bank[category]);
  const reused = used.has(template.subject);
  used.add(template.subject);

  const virality = clamp01(Math.pow(rng.next(), 1.35) * 0.85 + streamer.volatility * 0.25);
  const hidden = {
    virality,
    originality: clamp01(rng.range(0.15, 1) - (reused ? 0.35 : 0)),
    relevance: clamp01(rng.range(0.3, 0.95)),
    competition: clamp01((streamer.popularity / 100) * 0.45 + rng.range(0, 0.25)),
    trend: clamp01(rng.next()),
  };

  const rawLength = rng.int(9, 24) * 5; // 45–120 s
  const beatAt = Math.round(rawLength * rng.range(0.35, 0.8));
  const idealLength = Math.round(IDEAL_LENGTH[category] * rng.range(0.85, 1.2));
  const bins = Math.ceil(rawLength / 5);
  const intensity: number[] = [];
  for (let b = 0; b < bins; b++) {
    const t = b * 5 + 2.5;
    const dist = (t - beatAt) / 6;
    const peak = Math.exp(-dist * dist) * (0.55 + virality * 0.4);
    const after = t > beatAt ? Math.exp(-(t - beatAt) / 10) * 0.3 : 0;
    intensity.push(clamp01(0.12 + rng.range(0, 0.18) + peak + after));
  }

  return {
    id: `${streamer.id}-d${day}-s${segIndex}-m${n}`,
    streamerId: streamer.id,
    day,
    segmentIndex: segIndex,
    airMinute: segStart + rng.int(2, BALANCE.segmentMinutes - 2),
    category,
    description: template.description.replace(/\{n\}/g, streamer.name),
    subject: template.subject,
    quote: template.quote,
    rawLength,
    beatAt,
    idealLength,
    intensity,
    hidden,
  };
}

export type StreamStatus = 'upcoming' | 'live' | 'ended';

export function streamStatus(session: StreamSession, now: number): StreamStatus {
  if (now < session.startMinute) return 'upcoming';
  if (now < session.endMinute) return 'live';
  return 'ended';
}

export const segmentAired = (seg: StreamSegment, now: number): boolean => now >= seg.endMinute;

/** Today's sessions for all streamers. */
export function todaysSessions(worldSeed: number, day: number): StreamSession[] {
  return STREAMERS.map((s) => getSession(worldSeed, s, day));
}

// ---------- Visible estimates (what the player can see) ----------

const noise = (id: string, salt: string): number => {
  const r = new Rng(hashString(`${id}|${salt}`));
  return r.normal();
};

const sigmaFor = (trendSense: number): number => 0.28 / (1 + 0.4 * (trendSense - 1));

export function competitionAt(moment: StreamMoment, now: number): number {
  const hours = Math.max(0, now - moment.airMinute) / 60;
  return clamp01(moment.hidden.competition + hours * BALANCE.competitionPerHour);
}

export function freshness(moment: StreamMoment, now: number): number {
  const hours = Math.max(0, now - moment.airMinute) / 60;
  return Math.exp(-hours / BALANCE.freshnessHours);
}

export interface MomentEstimate {
  hypeStars: number; // 1–5
  confidence: 'low' | 'medium' | 'high';
  clippers: number;
  originality: 'Overdone' | 'Familiar' | 'Fresh angle';
  freshnessPct: number;
}

export function estimateMoment(moment: StreamMoment, now: number, trendSense: number): MomentEstimate {
  const sigma = sigmaFor(trendSense);
  const hype = clamp01(0.65 * moment.hidden.virality + 0.35 * moment.hidden.relevance + noise(moment.id, `hype${trendSense}`) * sigma);
  const comp = clamp01(competitionAt(moment, now) + noise(moment.id, `comp${trendSense}`) * sigma * 0.6);
  const origNoisy = moment.hidden.originality + noise(moment.id, `orig${trendSense}`) * sigma * 0.5;
  return {
    hypeStars: Math.max(1, Math.min(5, 1 + Math.round(hype * 4))),
    confidence: trendSense >= 4 ? 'high' : trendSense >= 2 ? 'medium' : 'low',
    clippers: Math.round(comp * 14),
    originality: origNoisy > 0.62 ? 'Fresh angle' : origNoisy < 0.35 ? 'Overdone' : 'Familiar',
    freshnessPct: Math.round(freshness(moment, now) * 100),
  };
}

/** What the player sees of a segment's chat activity: true signal plus noise that shrinks with Trend Sense. */
export function estimateChat(sessionKeyStr: string, seg: StreamSegment, trendSense: number): number {
  const sigma = 0.22 / (1 + 0.35 * (trendSense - 1));
  return clamp01(seg.chatActivity + noise(`${sessionKeyStr}#${seg.index}`, `chat${trendSense}`) * sigma);
}

// ---------- Daily trends ----------

export type TrendBoard = Record<PlatformId, Record<MomentCategory, number>>;

export function generateTrends(worldSeed: number, day: number): TrendBoard {
  const board = {} as TrendBoard;
  for (const p of PLATFORM_IDS) {
    const rng = seeded(worldSeed, 'trends', p, day);
    const row = Object.fromEntries(MOMENT_CATEGORIES.map((c) => [c, 1])) as Record<MomentCategory, number>;
    // Seeded Fisher–Yates: uniform and identical in every JS engine.
    const shuffled = [...MOMENT_CATEGORIES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    row[shuffled[0]!] = Math.round(rng.range(1.3, 1.55) * 100) / 100;
    row[shuffled[1]!] = Math.round(rng.range(1.15, 1.3) * 100) / 100;
    row[shuffled[2]!] = Math.round(rng.range(0.65, 0.8) * 100) / 100;
    board[p] = row;
  }
  return board;
}

// ---------- Title suggestions ----------

export function titleSuggestions(moment: StreamMoment, streamerName: string): Record<TitleStyle, string> {
  const h = Math.abs(hashString(moment.id));
  const sub = (s: string): string => s.replace(/\{n\}/g, streamerName).replace(/\{N\}/g, streamerName.toUpperCase());
  const hype = HYPE_TITLES[moment.category];
  const q = QUESTION_TITLES[moment.category];
  return {
    hype: sub(hype[h % hype.length]!),
    descriptive: `${streamerName} ${moment.subject}`,
    question: sub(q[h % q.length]!),
    quote: `"${moment.quote}"`,
  };
}
