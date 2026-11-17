// Save validation & migration. Converts unknown JSON into a safe GameState or reports why not.
// Every nested record (drafts, moments, clips, history, daily stats, ledger) is checked
// field by field; bad records are repaired with safe defaults or dropped, and every
// repair is listed so the player can be told.

import { BALANCE } from '../data/balance';
import { EFFECTS, HOOKS, MOMENT_CATEGORIES, SUBTITLES, THUMBNAILS, TITLE_STYLES } from '../data/editorOptions';
import { PLATFORM_IDS } from '../data/platforms';
import { STREAMER_BY_ID } from '../data/streamers';
import { createNewGame, SAVE_VERSION } from '../sim/initialState';
import type {
  ClipDraft,
  ClipHistoryPoint,
  DailyStat,
  GameState,
  LedgerEntry,
  MomentCategory,
  PerformanceFactors,
  PublishedClip,
  StreamMoment,
} from '../types/game';

export type ValidationResult = { ok: true; state: GameState; repaired: string[] } | { ok: false; error: string };

type Raw = Record<string, unknown>;
type Migration = (raw: Raw) => Raw;

/** migrations[n] upgrades a version-n save to version n+1. */
export const MIGRATIONS: Record<number, Migration> = {
  // v0: pre-release prototype format.
  0: (raw) => ({ ...raw }),
  // v1 → v2: rent consequences and game-over state.
  1: (raw) => ({ ...raw, missedRent: 0, gameOver: null }),
};

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): v is T => isStr(v) && (allowed as readonly string[]).includes(v);

export function migrate(raw: Raw): Raw {
  if (raw.version !== undefined && !isNum(raw.version)) throw new Error('Save version is not a number.');
  let version = isNum(raw.version) ? Math.floor(raw.version) : 0;
  let cur = raw;
  while (version < SAVE_VERSION) {
    const m = MIGRATIONS[version];
    if (!m) throw new Error(`No migration from save version ${version}`);
    cur = m(cur);
    version += 1;
    cur.version = version;
  }
  return cur;
}

/** Collects repairs for one record path. */
class Repairer {
  constructor(private out: string[]) {}
  num(obj: Raw, key: string, fallback: number, path: string, min = -Infinity, max = Infinity): number {
    const v = obj[key];
    if (!isNum(v)) {
      this.out.push(`${path}.${key} reset`);
      return fallback;
    }
    if (v < min || v > max) {
      this.out.push(`${path}.${key} clamped`);
      return Math.min(max, Math.max(min, v));
    }
    return v;
  }
}

const CATS = MOMENT_CATEGORIES as readonly MomentCategory[];

function validMoment(v: unknown): StreamMoment | null {
  if (!isObj(v)) return null;
  const h = v.hidden;
  if (
    !isStr(v.id) ||
    !isStr(v.streamerId) ||
    !STREAMER_BY_ID[v.streamerId] ||
    !oneOf(v.category, CATS) ||
    !isNum(v.rawLength) ||
    v.rawLength < 10 ||
    !isNum(v.beatAt) ||
    !isNum(v.idealLength) ||
    v.idealLength <= 0 ||
    !isNum(v.airMinute) ||
    !isNum(v.day) ||
    !isNum(v.segmentIndex) ||
    !Array.isArray(v.intensity) ||
    v.intensity.length === 0 ||
    !v.intensity.every(isNum) ||
    !isObj(h) ||
    !['virality', 'originality', 'relevance', 'competition', 'trend'].every((k) => isNum(h[k]))
  )
    return null;
  return {
    id: v.id,
    streamerId: v.streamerId,
    day: v.day,
    segmentIndex: v.segmentIndex,
    airMinute: v.airMinute,
    category: v.category,
    description: isStr(v.description) ? v.description : '',
    subject: isStr(v.subject) ? v.subject : 'Moment',
    quote: isStr(v.quote) ? v.quote : '…',
    rawLength: v.rawLength,
    beatAt: Math.min(v.rawLength - 1, Math.max(1, v.beatAt)),
    idealLength: v.idealLength,
    intensity: v.intensity as number[],
    hidden: {
      virality: clamp01(h.virality as number),
      originality: clamp01(h.originality as number),
      relevance: clamp01(h.relevance as number),
      competition: clamp01(h.competition as number),
      trend: clamp01(h.trend as number),
    },
  };
}

function validDraft(v: unknown, rep: Repairer, repaired: string[], i: number): ClipDraft | null {
  if (!isObj(v) || !isStr(v.id)) return null;
  const moment = validMoment(v.moment);
  if (!moment) return null;
  if (!oneOf(v.status, ['editing', 'ready'] as const)) return null; // published drafts are no longer kept
  const path = `draft[${i}]`;
  let trimStart = rep.num(v, 'trimStart', 0, path, 0, moment.rawLength - 5);
  let trimEnd = rep.num(v, 'trimEnd', moment.rawLength, path, 5, moment.rawLength);
  if (trimEnd - trimStart < 5) {
    trimStart = 0;
    trimEnd = moment.rawLength;
    repaired.push(`${path} trim reset`);
  }
  const effects = Array.isArray(v.effects) ? v.effects.filter((e): e is ClipDraft['effects'][number] => oneOf(e, EFFECTS.map((x) => x.id))) : [];
  const quality = v.status === 'ready' ? (isNum(v.quality) ? Math.min(100, Math.max(0, v.quality)) : null) : null;
  return {
    id: v.id,
    moment,
    createdAtMinute: isNum(v.createdAtMinute) ? v.createdAtMinute : moment.airMinute,
    trimStart,
    trimEnd,
    title: isStr(v.title) ? v.title.slice(0, 80) : '',
    titleStyle: oneOf(v.titleStyle, TITLE_STYLES.map((t) => t.id)) ? v.titleStyle : 'descriptive',
    hook: oneOf(v.hook, HOOKS.map((h) => h.id)) ? v.hook : 'none',
    subtitles: oneOf(v.subtitles, SUBTITLES.map((s) => s.id)) ? v.subtitles : 'none',
    effects: Array.from(new Set(effects)),
    thumbnail: oneOf(v.thumbnail, THUMBNAILS.map((t) => t.id)) ? v.thumbnail : 'action',
    // A "ready" draft without a valid quality must be rendered again.
    status: v.status === 'ready' && quality === null ? 'editing' : v.status,
    quality,
    xpAwarded: v.xpAwarded === true,
  };
}

function validClip(v: unknown, rep: Repairer, i: number): PublishedClip | null {
  if (!isObj(v)) return null;
  if (!isStr(v.id) || !oneOf(v.platform, PLATFORM_IDS) || !isStr(v.streamerId) || !STREAMER_BY_ID[v.streamerId]) return null;
  if (!oneOf(v.category, CATS) || !isNum(v.targetViews) || v.targetViews < 0 || !isNum(v.tau) || v.tau <= 0 || !isNum(v.publishedAtMinute)) return null;
  const path = `clip[${i}]`;
  const f = isObj(v.factors) ? v.factors : {};
  const fnum = (k: string, d: number): number => (isNum(f[k]) ? (f[k] as number) : d);
  const factors: PerformanceFactors = {
    quality: fnum('quality', 1),
    platformFit: fnum('platformFit', 1),
    audienceFit: fnum('audienceFit', 1),
    trend: fnum('trend', 1),
    competition: fnum('competition', 1),
    originality: fnum('originality', 1),
    reputation: fnum('reputation', 1),
    streamerPull: fnum('streamerPull', 1),
    luck: fnum('luck', 1),
    viral: f.viral === true,
    fatigue: fnum('fatigue', 1),
  };
  const history: ClipHistoryPoint[] = Array.isArray(v.history)
    ? v.history.filter((h): h is ClipHistoryPoint => isObj(h) && isNum(h.minute) && isNum(h.views)).slice(-BALANCE.historyCap)
    : [];
  const views = rep.num(v, 'views', 0, path, 0, v.targetViews);
  return {
    id: v.id,
    draftId: isStr(v.draftId) ? v.draftId : v.id,
    platform: v.platform,
    streamerId: v.streamerId,
    category: v.category,
    title: isStr(v.title) && v.title.trim() ? v.title : 'Untitled clip',
    thumbnail: oneOf(v.thumbnail, THUMBNAILS.map((t) => t.id)) ? v.thumbnail : 'action',
    quality: rep.num(v, 'quality', 50, path, 0, 100),
    lengthSec: rep.num(v, 'lengthSec', 20, path, 0, 600),
    publishedAtMinute: v.publishedAtMinute,
    factors,
    targetViews: v.targetViews,
    expectedViews: isNum(v.expectedViews) ? v.expectedViews : v.targetViews,
    repApplied: v.repApplied === undefined ? true : v.repApplied === true,
    tau: v.tau,
    likeRate: rep.num(v, 'likeRate', 0.05, path, 0, 1),
    commentRate: rep.num(v, 'commentRate', 0.005, path, 0, 1),
    shareRate: rep.num(v, 'shareRate', 0.01, path, 0, 1),
    followRate: rep.num(v, 'followRate', 0.01, path, 0, 1),
    views,
    likes: rep.num(v, 'likes', 0, path, 0),
    comments: rep.num(v, 'comments', 0, path, 0),
    shares: rep.num(v, 'shares', 0, path, 0),
    followersGained: rep.num(v, 'followersGained', 0, path, 0),
    revenue: rep.num(v, 'revenue', 0, path, 0),
    history: history.length ? history : [{ minute: v.publishedAtMinute, views }],
  };
}

function validDaily(v: unknown): DailyStat | null {
  if (!isObj(v) || !isNum(v.day)) return null;
  const n = (k: string): number => (isNum(v[k]) ? Math.max(0, v[k] as number) : 0);
  return { day: v.day, views: n('views'), followers: n('followers'), revenue: n('revenue'), expenses: n('expenses'), clipsPublished: n('clipsPublished') };
}

function validLedger(v: unknown): LedgerEntry | null {
  if (!isObj(v) || !isNum(v.amount) || !isNum(v.minute) || !isStr(v.label) || !oneOf(v.kind, ['income', 'expense'] as const)) return null;
  return { minute: v.minute, amount: Math.abs(v.amount), label: v.label, kind: v.kind };
}

/** Filter an array of records, logging how many were dropped. */
function records<T>(raw: unknown, fn: (v: unknown, i: number) => T | null, label: string, repaired: string[]): T[] | null {
  if (!Array.isArray(raw)) return null;
  const out: T[] = [];
  raw.forEach((v, i) => {
    const r = fn(v, i);
    if (r) out.push(r);
  });
  if (out.length < raw.length) repaired.push(`dropped ${raw.length - out.length} corrupted ${label}`);
  return out;
}

export function validateSave(input: unknown): ValidationResult {
  if (!isObj(input)) return { ok: false, error: 'Save data is not an object.' };
  if (isNum(input.version) && input.version > SAVE_VERSION)
    return { ok: false, error: `Save is from a newer version of the game (v${input.version}).` };

  let raw: Raw;
  try {
    raw = migrate(input);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const required = ['worldSeed', 'minute', 'cash', 'platforms', 'drafts', 'published'];
  for (const k of required) if (!(k in raw)) return { ok: false, error: `Save is missing "${k}".` };
  if (!isNum(raw.worldSeed) || !isNum(raw.minute)) return { ok: false, error: 'Save clock or seed is corrupted.' };
  if (!Array.isArray(raw.drafts) || !Array.isArray(raw.published)) return { ok: false, error: 'Save clip lists are corrupted.' };
  if (!isObj(raw.platforms)) return { ok: false, error: 'Save platform data is corrupted.' };

  const base = createNewGame(raw.worldSeed);
  const repaired: string[] = [];
  const rep = new Repairer(repaired);
  const top = (key: keyof GameState, fallback: number, min = -Infinity, max = Infinity): number =>
    key in raw ? rep.num(raw, key, fallback, 'save', min, max) : fallback;

  const level = Math.round(top('level', 1, 1, 500));
  const state: GameState = {
    ...base,
    version: SAVE_VERSION,
    worldSeed: raw.worldSeed,
    rngState: top('rngState', base.rngState),
    minute: top('minute', base.minute, 0),
    cash: top('cash', base.cash, 0, 1e12),
    rentOwed: top('rentOwed', 0, 0, 1e9),
    missedRent: Math.round(top('missedRent', 0, 0, 99)),
    gameOver: isStr(raw.gameOver) ? raw.gameOver : null,
    reputation: top('reputation', 0, 0, 100),
    energy: top('energy', BALANCE.maxEnergy, 0, BALANCE.maxEnergy),
    drinksToday: Math.round(top('drinksToday', 0, 0, 99)),
    lastPetMinute: top('lastPetMinute', -9999),
    level,
    xp: top('xp', 0, 0, BALANCE.xpPerLevel(level)),
    createdAt: top('createdAt', Date.now()),
  };

  if (isObj(raw.skills)) {
    for (const k of Object.keys(base.skills) as (keyof GameState['skills'])[]) {
      const sk = raw.skills[k];
      if (isObj(sk) && isNum(sk.level) && isNum(sk.xp)) {
        const lvl = Math.max(1, Math.min(BALANCE.maxSkillLevel, Math.round(sk.level)));
        state.skills[k] = { level: lvl, xp: Math.max(0, Math.min(sk.xp, BALANCE.skillXpPerLevel(lvl))) };
      } else if (sk !== undefined) repaired.push(`skill ${k} reset`);
    }
  }

  for (const p of PLATFORM_IDS) {
    const a = (raw.platforms as Raw)[p];
    if (!isObj(a)) {
      repaired.push(`${p} account reset`);
      continue;
    }
    state.platforms[p] = {
      followers: rep.num(a, 'followers', 0, p, 0),
      totalViews: rep.num(a, 'totalViews', 0, p, 0),
      monetized: a.monetized === true || base.platforms[p].monetized,
      monetizedAtMinute: isNum(a.monetizedAtMinute) ? a.monetizedAtMinute : base.platforms[p].monetizedAtMinute,
      revenue: rep.num(a, 'revenue', 0, p, 0),
    };
    state.platforms[p].followers = Math.round(state.platforms[p].followers);
  }

  // Older saves kept published drafts; the published clip now holds everything needed.
  const draftsRaw = (raw.drafts as unknown[]).filter((d) => !(isObj(d) && d.status === 'published'));
  state.drafts = records(draftsRaw, (v, i) => validDraft(v, rep, repaired, i), 'drafts', repaired) ?? [];
  state.published = records(raw.published, (v, i) => validClip(v, rep, i), 'clips', repaired) ?? [];

  if (isObj(raw.scanned)) {
    const scanned: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(raw.scanned)) if (Array.isArray(v)) scanned[k] = v.filter(isNum);
    state.scanned = scanned;
  }
  if (Array.isArray(raw.usedMomentIds)) state.usedMomentIds = raw.usedMomentIds.filter(isStr);
  const ledger = records(raw.ledger, validLedger, 'ledger entries', repaired);
  if (ledger) state.ledger = ledger.slice(-BALANCE.ledgerCap);
  const daily = records(raw.daily, validDaily, 'daily stats', repaired);
  if (daily && daily.length) state.daily = daily;
  if (Array.isArray(raw.equipment)) {
    const eq = raw.equipment.filter((x): x is string => x === 'basic-laptop');
    state.equipment = eq.length ? eq : ['basic-laptop'];
  }
  if (isObj(raw.objectives)) for (const k of Object.keys(base.objectives) as (keyof GameState['objectives'])[]) state.objectives[k] = raw.objectives[k] === true;
  if (isObj(raw.stats)) for (const k of Object.keys(base.stats) as (keyof GameState['stats'])[]) state.stats[k] = isNum(raw.stats[k]) ? Math.max(0, raw.stats[k] as number) : 0;

  const bad = findNonFinite(state);
  if (bad) return { ok: false, error: `Save contains an invalid number at ${bad}.` };
  return { ok: true, state, repaired };
}

/** Returns the path of the first NaN/Infinity in a value, or null. */
export function findNonFinite(v: unknown, path = 'state'): string | null {
  if (typeof v === 'number') return Number.isFinite(v) ? null : path;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findNonFinite(v[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) {
      const r = findNonFinite(x, `${path}.${k}`);
      if (r) return r;
    }
  }
  return null;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
