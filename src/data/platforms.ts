import type { AudienceMix, MomentCategory, PlatformId, ThumbnailId, TitleStyle } from '../types/game';

export interface MonetizationRule {
  minFollowers: number;
  minTotalViews: number;
  /** Revenue per 1,000 monetized views (USD). */
  rpm: number;
  programName: string;
}

export interface PlatformDef {
  id: PlatformId;
  name: string;
  tagline: string;
  color: string;
  format: string;
  audience: AudienceMix;
  categoryPref: Record<MomentCategory, number>;
  titlePref: Record<TitleStyle, number>;
  thumbnailWeight: number;
  thumbnailPref: Record<ThumbnailId, number>;
  /** Preferred clip length in seconds. */
  idealLength: [number, number];
  baseReach: number;
  /** Lognormal sigma for luck. Higher = swingier algorithm. */
  volatility: number;
  /** Chance multiplier for a viral breakout. */
  viralChance: number;
  /** Lifecycle time constant in game hours. */
  tauHours: number;
  likeRate: number;
  commentRate: number;
  shareRate: number;
  followRate: number;
  monetization: MonetizationRule;
  algorithmNote: string;
}

// All platforms are fictional.
export const PLATFORMS: Record<PlatformId, PlatformDef> = {
  blink: {
    id: 'blink',
    name: 'Blink',
    tagline: 'Endless vertical shorts. Lives and dies by the first second.',
    color: '#ff4f9a',
    format: 'Vertical short',
    audience: { teens: 0.55, youngAdults: 0.35, adults: 0.1 },
    categoryPref: { funny: 1.35, rage: 1.25, emotional: 0.8, unexpected: 1.3, controversial: 0.9, gameplay: 0.95, quote: 0.85 },
    titlePref: { hype: 1.2, descriptive: 0.85, question: 1.0, quote: 0.9 },
    thumbnailWeight: 0.3,
    thumbnailPref: { reaction: 1.1, action: 1.0, 'text-heavy': 0.8 },
    idealLength: [12, 35],
    baseReach: 2600,
    volatility: 0.95,
    viralChance: 1.4,
    tauHours: 8,
    likeRate: 0.075,
    commentRate: 0.004,
    shareRate: 0.012,
    followRate: 0.011,
    monetization: { minFollowers: 400, minTotalViews: 0, rpm: 1.5, programName: 'Blink Creator Pool' },
    algorithmNote: 'Swingy. Rewards strong hooks, short runtime and funny/unexpected chaos.',
  },
  tubely: {
    id: 'tubely',
    name: 'Tubely',
    tagline: 'Long-tail video library. Slow to start, steady forever.',
    color: '#ff8a3d',
    format: 'Horizontal video',
    audience: { teens: 0.25, youngAdults: 0.4, adults: 0.35 },
    categoryPref: { funny: 1.0, rage: 0.95, emotional: 1.25, unexpected: 1.0, controversial: 0.95, gameplay: 1.35, quote: 1.1 },
    titlePref: { hype: 0.9, descriptive: 1.2, question: 1.1, quote: 1.0 },
    thumbnailWeight: 0.7,
    thumbnailPref: { reaction: 1.15, action: 1.1, 'text-heavy': 1.0 },
    idealLength: [30, 75],
    baseReach: 1100,
    volatility: 0.45,
    viralChance: 0.6,
    tauHours: 36,
    likeRate: 0.045,
    commentRate: 0.006,
    shareRate: 0.005,
    followRate: 0.016,
    monetization: { minFollowers: 300, minTotalViews: 20000, rpm: 4.0, programName: 'Tubely Partner Program' },
    algorithmNote: 'Stable. Rewards quality, clear titles and good thumbnails. Pays best per view.',
  },
  chirp: {
    id: 'chirp',
    name: 'Chirp',
    tagline: 'Fast-moving social feed. Hot takes and quotable lines travel far.',
    color: '#4fd8e8',
    format: 'Feed clip',
    audience: { teens: 0.15, youngAdults: 0.45, adults: 0.4 },
    categoryPref: { funny: 1.05, rage: 1.0, emotional: 0.9, unexpected: 1.05, controversial: 1.45, gameplay: 0.7, quote: 1.4 },
    titlePref: { hype: 1.0, descriptive: 0.9, question: 1.15, quote: 1.3 },
    thumbnailWeight: 0.2,
    thumbnailPref: { reaction: 1.0, action: 0.95, 'text-heavy': 1.1 },
    idealLength: [10, 45],
    baseReach: 1600,
    volatility: 0.7,
    viralChance: 1.0,
    tauHours: 4,
    likeRate: 0.05,
    commentRate: 0.012,
    shareRate: 0.02,
    followRate: 0.008,
    monetization: { minFollowers: 0, minTotalViews: 0, rpm: 0.5, programName: 'Chirp Boost (open to all)' },
    algorithmNote: 'Burns fast. Loves controversy and quotes. Monetized from day one, but pays little.',
  },
};

export const PLATFORM_IDS: PlatformId[] = ['blink', 'tubely', 'chirp'];
