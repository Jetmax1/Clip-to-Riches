// Publishing / platform performance simulation. Pure functions.

import { BALANCE } from '../data/balance';
import { PLATFORMS, type PlatformDef } from '../data/platforms';
import type {
  AudienceMix,
  ClipDraft,
  PerformanceFactors,
  PlatformAccount,
  PlatformId,
  PublishedClip,
  Streamer,
} from '../types/game';
import { clamp, clamp01, Rng } from './rng';
import { competitionAt, freshness, type TrendBoard } from './streams';

export function lengthFit(len: number, [lo, hi]: [number, number]): number {
  if (len >= lo && len <= hi) return 1;
  const dist = len < lo ? (lo - len) / lo : (len - hi) / hi;
  return Math.max(0.5, 1 - dist * 0.9);
}

export function audienceFit(a: AudienceMix, b: AudienceMix): number {
  const l1 = Math.abs(a.teens - b.teens) + Math.abs(a.youngAdults - b.youngAdults) + Math.abs(a.adults - b.adults);
  return clamp(1 - 0.6 * (l1 / 2), 0.4, 1);
}

export interface FitPreview {
  platformFit: number;
  audienceFit: number;
  trend: number;
  overall: number; // 0–1 normalised for UI stars
}

export function platformFitFor(draft: ClipDraft, p: PlatformDef): number {
  const len = draft.trimEnd - draft.trimStart;
  const cat = p.categoryPref[draft.moment.category];
  const title = Math.sqrt(p.titlePref[draft.titleStyle]);
  const thumb = 1 + p.thumbnailWeight * (p.thumbnailPref[draft.thumbnail] - 1);
  return cat * lengthFit(len, p.idealLength) * title * thumb;
}

export function trendFactor(draft: ClipDraft, platform: PlatformId, trends: TrendBoard, now: number): number {
  const h = draft.moment.hidden;
  const fresh = freshness(draft.moment, now);
  return (0.6 + 0.6 * h.relevance * fresh + 0.3 * h.trend * fresh) * trends[platform][draft.moment.category];
}

export function previewFit(draft: ClipDraft, platform: PlatformId, streamer: Streamer, trends: TrendBoard, now: number): FitPreview {
  const p = PLATFORMS[platform];
  const pf = platformFitFor(draft, p);
  const af = audienceFit(streamer.audience, p.audience);
  const tr = trendFactor(draft, platform, trends, now);
  const overall = clamp01((pf * af * tr - 0.35) / 1.1);
  return { platformFit: pf, audienceFit: af, trend: tr, overall };
}

export interface PublishInput {
  id: string;
  draft: ClipDraft;
  quality: number;
  platform: PlatformId;
  streamer: Streamer;
  account: PlatformAccount;
  reputation: number;
  trends: TrendBoard;
  now: number;
  /** Clips of the same category published on this platform within the fatigue window. */
  recentSameCategory?: number;
  rng: Rng;
}

export function simulatePublish(input: PublishInput): PublishedClip {
  const { draft, quality, platform, streamer, account, reputation, trends, now, rng } = input;
  const p = PLATFORMS[platform];
  const m = draft.moment;
  const q = clamp(quality, 0, 100);

  const qualityFactor = Math.pow(Math.max(q, 5) / 60, BALANCE.qualityExponent);
  const pf = platformFitFor(draft, p);
  const af = audienceFit(streamer.audience, p.audience);
  const tr = trendFactor(draft, platform, trends, now);
  const comp = 1 - 0.6 * competitionAt(m, now);
  const orig = 0.8 + 0.4 * m.hidden.originality;
  const rep = 1 + Math.log10(1 + account.followers) / 4 + reputation / 150;
  const pull = 0.55 + (streamer.popularity / 100) * 0.9;
  const vir = 0.5 + m.hidden.virality;

  const fatigue = Math.max(BALANCE.fatigueFloor, Math.pow(BALANCE.fatiguePerRecentClip, input.recentSameCategory ?? 0));

  const expected = p.baseReach * qualityFactor * pf * af * tr * comp * orig * rep * pull * vir * fatigue;
  const sigma = p.volatility;
  const luck = Math.exp(rng.normal() * sigma - (sigma * sigma) / 2);

  const viralChance = clamp(0.045 * p.viralChance * m.hidden.virality * Math.pow(q / 70, 2) * trends[platform][m.category], 0, 0.35);
  const viral = rng.next() < viralChance;
  const viralMult = viral ? 5 + rng.next() * 10 : 1;
  const targetViews = Math.round(clamp(expected * luck * viralMult, 3, 5_000_000));

  const factors: PerformanceFactors = {
    quality: round2(qualityFactor),
    platformFit: round2(pf),
    audienceFit: round2(af),
    trend: round2(tr),
    competition: round2(comp),
    originality: round2(orig),
    reputation: round2(rep),
    streamerPull: round2(pull),
    luck: round2(luck * viralMult),
    viral,
    fatigue: round2(fatigue),
  };

  return {
    id: input.id,
    draftId: draft.id,
    platform,
    streamerId: streamer.id,
    category: m.category,
    title: draft.title.trim(),
    thumbnail: draft.thumbnail,
    quality: q,
    lengthSec: Math.round(draft.trimEnd - draft.trimStart),
    publishedAtMinute: now,
    factors,
    targetViews,
    expectedViews: Math.round(expected),
    repApplied: false,
    tau: p.tauHours * 60 * (viral ? 1.3 : 1),
    likeRate: p.likeRate * (0.6 + (q / 100) * 0.8),
    commentRate: p.commentRate * (m.category === 'controversial' ? 2.2 : 1),
    shareRate: p.shareRate * (0.5 + m.hidden.virality) * (viral ? 1.5 : 1),
    followRate: p.followRate * (0.5 + q / 100),
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    followersGained: 0,
    revenue: 0,
    history: [{ minute: now, views: 0 }],
  };
}

/** Views a clip has reached at an absolute minute. Monotonic, asymptotic to targetViews. */
export function viewsAt(clip: PublishedClip, minute: number): number {
  const age = Math.max(0, minute - clip.publishedAtMinute);
  return Math.floor(clip.targetViews * (1 - Math.exp(-age / clip.tau)));
}

export function monetizationEligible(account: PlatformAccount, p: PlatformDef): boolean {
  return account.followers >= p.monetization.minFollowers && account.totalViews >= p.monetization.minTotalViews;
}

export const isSettled = (clip: PublishedClip, now: number): boolean => now - clip.publishedAtMinute > clip.tau * 4;

const round2 = (v: number): number => Math.round(v * 100) / 100;
