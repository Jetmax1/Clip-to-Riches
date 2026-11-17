// Core shared interfaces for CLIP TO RICHES.
// Simulation (src/sim), state (src/state), saves (src/save), UI (src/ui) and the
// Phaser world (src/game) all depend on these types — never the other way round.

export type MomentCategory =
  | 'funny'
  | 'rage'
  | 'emotional'
  | 'unexpected'
  | 'controversial'
  | 'gameplay'
  | 'quote';

export type StreamCategory = 'gaming' | 'podcast' | 'irl';
export type PlatformId = 'blink' | 'tubely' | 'chirp';
export type SkillId = 'editing' | 'trendSense' | 'marketing' | 'management' | 'networking';

export type TitleStyle = 'hype' | 'descriptive' | 'question' | 'quote';
export type HookId = 'cold-open' | 'text-teaser' | 'countdown' | 'none';
export type SubtitleId = 'none' | 'basic' | 'bold-pop' | 'karaoke';
export type EffectId = 'zoom-punch' | 'sound-fx' | 'slow-mo' | 'meme-overlay' | 'color-grade';
export type ThumbnailId = 'reaction' | 'action' | 'text-heavy';

/** Share of an audience in three broad groups. Values sum to ~1. */
export interface AudienceMix {
  teens: number;
  youngAdults: number;
  adults: number;
}

export interface PortraitPalette {
  skin: string;
  hair: string;
  shirt: string;
  accent: string;
  hairStyle: 'short' | 'long' | 'spiky' | 'cap' | 'bun';
  glasses?: boolean;
  headset?: boolean;
}

export interface Streamer {
  id: string;
  name: string;
  category: StreamCategory;
  tagline: string;
  traits: string[];
  /** 0–100, drives baseline reach of clips from this streamer. */
  popularity: number;
  audience: AudienceMix;
  /** Relative likelihood of each moment category appearing on stream. */
  momentWeights: Record<MomentCategory, number>;
  /** Average base virality 0–1 of this streamer's moments. */
  volatility: number;
  schedule: { startHour: number; durationHours: number };
  portrait: PortraitPalette;
}

/** Hidden attributes — never shown raw to the player. All 0–1. */
export interface MomentHidden {
  virality: number;
  originality: number;
  relevance: number;
  /** Base competition at air time; grows as more clippers notice it. */
  competition: number;
  trend: number;
}

export interface StreamMoment {
  id: string;
  streamerId: string;
  day: number;
  segmentIndex: number;
  /** Absolute game minute when the moment aired. */
  airMinute: number;
  category: MomentCategory;
  description: string;
  subject: string;
  quote: string;
  /** Raw footage length in seconds available to the editor. */
  rawLength: number;
  /** Second (within raw footage) where the key beat lands. */
  beatAt: number;
  /** Ideal clip length in seconds for this moment. */
  idealLength: number;
  /** Intensity per 5-second bin, 0–1, used for the editor waveform. */
  intensity: number[];
  hidden: MomentHidden;
}

export interface StreamSegment {
  index: number;
  startMinute: number;
  endMinute: number;
  /** Visible chat activity 0–1 (noisy hint of what is inside). */
  chatActivity: number;
  momentIds: string[];
}

export interface StreamSession {
  key: string;
  streamerId: string;
  day: number;
  startMinute: number;
  endMinute: number;
  segments: StreamSegment[];
  moments: Record<string, StreamMoment>;
}

export interface ClipDraft {
  id: string;
  moment: StreamMoment; // snapshot so saves never depend on generator stability
  createdAtMinute: number;
  trimStart: number;
  trimEnd: number;
  title: string;
  titleStyle: TitleStyle;
  hook: HookId;
  subtitles: SubtitleId;
  effects: EffectId[];
  thumbnail: ThumbnailId;
  status: 'editing' | 'ready' | 'published';
  quality: number | null;
  /** Render XP is granted once per draft, so re-rendering can't farm skill. */
  xpAwarded?: boolean;
}

export interface QualityPart {
  id: string;
  label: string;
  score: number; // 0–100
  weight: number;
  tip: string;
}

export interface QualityBreakdown {
  total: number; // 0–100
  parts: QualityPart[];
  skillMultiplier: number;
  valid: boolean;
  errors: string[];
}

export interface PerformanceFactors {
  quality: number;
  platformFit: number;
  audienceFit: number;
  trend: number;
  competition: number;
  originality: number;
  reputation: number;
  streamerPull: number;
  luck: number;
  viral: boolean;
  /** Audience fatigue from recent clips of the same category on the same platform (1 = none). */
  fatigue?: number;
}

export interface ClipHistoryPoint {
  minute: number;
  views: number;
}

export interface PublishedClip {
  id: string;
  draftId: string;
  platform: PlatformId;
  streamerId: string;
  category: MomentCategory;
  title: string;
  thumbnail: ThumbnailId;
  quality: number;
  lengthSec: number;
  publishedAtMinute: number;
  factors: PerformanceFactors;
  targetViews: number;
  /** Views expected before luck; used to judge over/under-performance for reputation. */
  expectedViews?: number;
  /** Reputation is settled once, when the clip's run is mostly over. */
  repApplied?: boolean;
  /** Lifecycle time constant in game minutes. */
  tau: number;
  likeRate: number;
  commentRate: number;
  shareRate: number;
  followRate: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  followersGained: number;
  revenue: number;
  history: ClipHistoryPoint[];
}

export interface PlatformAccount {
  followers: number;
  totalViews: number;
  monetized: boolean;
  monetizedAtMinute: number | null;
  revenue: number;
}

export interface SkillState {
  level: number;
  xp: number;
}

export interface LedgerEntry {
  minute: number;
  amount: number;
  label: string;
  kind: 'income' | 'expense';
}

export interface DailyStat {
  day: number;
  views: number;
  followers: number;
  revenue: number;
  expenses: number;
  clipsPublished: number;
}

export type ObjectiveId =
  | 'open-computer'
  | 'pick-streamer'
  | 'scan-stream'
  | 'select-moment'
  | 'finish-edit'
  | 'publish'
  | 'check-analytics'
  | 'save-game';

export interface GameState {
  version: number;
  worldSeed: number;
  rngState: number;
  /** Absolute game minutes since day 1 00:00 (day 1 starts at minute 0). */
  minute: number;
  cash: number;
  rentOwed: number;
  /** Consecutive rent days missed while in debt. Eviction at BALANCE.rent.evictAfterMissed. */
  missedRent: number;
  /** Non-null when the run has ended (e.g. evicted). */
  gameOver: string | null;
  reputation: number;
  energy: number;
  drinksToday: number;
  lastPetMinute: number;
  xp: number;
  level: number;
  skills: Record<SkillId, SkillState>;
  platforms: Record<PlatformId, PlatformAccount>;
  /** sessionKey -> scanned segment indices */
  scanned: Record<string, number[]>;
  usedMomentIds: string[];
  drafts: ClipDraft[];
  published: PublishedClip[];
  ledger: LedgerEntry[];
  daily: DailyStat[];
  employees: never[];
  office: 'bedroom';
  equipment: string[];
  objectives: Record<ObjectiveId, boolean>;
  stats: { clipsEdited: number; clipsPublished: number; viralClips: number; segmentsScanned: number };
  createdAt: number;
}

export type NoticeTone = 'info' | 'good' | 'bad' | 'viral' | 'level';

export interface Notice {
  tone: NoticeTone;
  text: string;
}

export type ActionResult = { ok: true; notices: Notice[] } | { ok: false; reason: string };
