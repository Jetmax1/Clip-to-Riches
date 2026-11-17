// Tunable balance constants. Keep every gameplay number here so it can be tweaked
// without touching simulation code.

export const BALANCE = {
  startingCash: 250,
  startMinute: 9 * 60, // day 1, 09:00
  /** Wake-up hour. Also the "broadcast day" boundary: yesterday's VODs expire here. */
  wakeHour: 8,
  maxEnergy: 100,

  /** Real milliseconds per game minute at 1x speed. */
  realMsPerGameMinute: 250,
  /** Offline progress cap, in game minutes. */
  offlineCapMinutes: 8 * 60,
  /** Offline progress smaller than this is ignored (avoids "while you were away" spam). */
  offlineMinMinutes: 60,

  segmentMinutes: 30,
  scan: { minutes: 20, energy: 6 },
  finishEdit: { minutes: 45, energy: 20 },
  publish: { minutes: 10, energy: 3 },
  /** Drink price escalates per drink today: base * growth^n. Extra drinks cause a morning crash. */
  drink: { price: 4, priceGrowth: 1.6, energy: 25, maxPerDay: 3, crashPerExtraDrink: 10 },
  pet: { energy: 3, cooldownMinutes: 120 },
  /** Energy restored per hour slept (full after 8 hours). */
  sleepEnergyPerHour: 12.5,

  rent: { amount: 120, everyDays: 7, lateFee: 15, evictAfterMissed: 3 },

  /** Competition added per game hour after a moment airs. */
  competitionPerHour: 0.035,
  /** Freshness decay time constant (hours) used by exp(-h / freshnessHours). */
  freshnessHours: 18,

  /** Quality → reach exponent: views scale with (quality / 60) ^ qualityExponent. */
  qualityExponent: 1.5,
  /** Reach multiplier per recent clip of the same category on the same platform (audience fatigue). */
  fatiguePerRecentClip: 0.85,
  fatigueFloor: 0.6,
  fatigueWindowMinutes: 24 * 60,

  reputation: {
    /** Fraction of reputation lost per day (decays toward 0). */
    dailyDecay: 0.02,
    maxGainPerClip: 2.5,
    maxLossPerClip: 2,
  },

  maxEffectsBasicLaptop: 2,
  /** How far a moment's hidden taste can shift an editor option's suitability (±). */
  momentTasteSpread: 14,

  xpPerLevel: (level: number): number => 100 + (level - 1) * 60,
  skillXpPerLevel: (level: number): number => 40 + (level - 1) * 40,
  maxSkillLevel: 10,

  ledgerCap: 200,
  historyCap: 96,
  /** Keep this many published drafts' full data; older published drafts are pruned. */
  publishedDraftKeep: 0,
} as const;

export const MINUTES_PER_DAY = 24 * 60;
