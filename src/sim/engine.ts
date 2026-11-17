// Game reducers. Each takes a *mutable draft* of GameState (immer recipe style) and
// returns an ActionResult. They validate before mutating, so a failed action leaves
// the state untouched. No React, Phaser or browser APIs in here.

import { BALANCE } from '../data/balance';
import { PLATFORMS, PLATFORM_IDS } from '../data/platforms';
import { getStreamer, STREAMER_BY_ID } from '../data/streamers';
import type {
  ActionResult,
  ClipDraft,
  DailyStat,
  GameState,
  Notice,
  ObjectiveId,
  PlatformId,
  PublishedClip,
  SkillId,
} from '../types/game';
import { isSettled, monetizationEligible, simulatePublish, viewsAt } from './publishing';
import { computeQuality, inferTitleStyle, maxEffectsFor } from './quality';
import { clamp, seeded } from './rng';
import { generateTrends, getSession, segmentAired, sessionKey, titleSuggestions } from './streams';
import { dayOf, minutesUntilWake, streamDayOf } from './time';

const ok = (notices: Notice[] = []): ActionResult => ({ ok: true, notices });
const fail = (reason: string): ActionResult => ({ ok: false, reason });

const VIEW_MILESTONES = [1_000, 10_000, 100_000, 1_000_000];
const OPENING_BALANCE_LABEL = 'Savings';

// ---------------- helpers ----------------

export function ensureDaily(s: GameState, day: number): DailyStat {
  let d = s.daily.find((x) => x.day === day);
  if (!d) {
    d = { day, views: 0, followers: 0, revenue: 0, expenses: 0, clipsPublished: 0 };
    s.daily.push(d);
    s.daily.sort((a, b) => a.day - b.day);
    if (s.daily.length > 120) s.daily.splice(0, s.daily.length - 120);
  }
  return d;
}

/**
 * Ledger entries keep exact (4dp) amounts and are merged per (day, label, kind), so
 * per-tick revenue from several platforms neither loses cents nor floods the log.
 * The opening balance is never evicted.
 */
export function addLedger(s: GameState, amount: number, label: string, kind: 'income' | 'expense'): void {
  if (!(amount > 0)) return;
  const day = dayOf(s.minute);
  for (let i = s.ledger.length - 1; i >= 0; i--) {
    const e = s.ledger[i]!;
    if (dayOf(e.minute) !== day) break;
    if (e.label === label && e.kind === kind) {
      e.amount = round4(e.amount + amount);
      e.minute = s.minute;
      return;
    }
  }
  s.ledger.push({ minute: s.minute, amount: round4(amount), label, kind });
  while (s.ledger.length > BALANCE.ledgerCap) {
    const keepFirst = s.ledger[0]?.label === OPENING_BALANCE_LABEL;
    s.ledger.splice(keepFirst ? 1 : 0, 1);
  }
}

export function completeObjective(s: GameState, id: ObjectiveId): Notice[] {
  if (s.objectives[id]) return [];
  s.objectives[id] = true;
  return [];
}

export function addXp(s: GameState, amount: number): Notice[] {
  const notices: Notice[] = [];
  s.xp += Math.max(0, Math.round(amount));
  while (s.xp >= BALANCE.xpPerLevel(s.level)) {
    s.xp -= BALANCE.xpPerLevel(s.level);
    s.level += 1;
    notices.push({ tone: 'level', text: `Creator level ${s.level}!` });
  }
  return notices;
}

const SKILL_NAMES: Record<SkillId, string> = {
  editing: 'Editing',
  trendSense: 'Trend Sense',
  marketing: 'Marketing',
  management: 'Management',
  networking: 'Networking',
};

export function addSkillXp(s: GameState, skill: SkillId, amount: number): Notice[] {
  const notices: Notice[] = [];
  const st = s.skills[skill];
  if (st.level >= BALANCE.maxSkillLevel) return notices;
  st.xp += Math.max(0, Math.round(amount));
  while (st.level < BALANCE.maxSkillLevel && st.xp >= BALANCE.skillXpPerLevel(st.level)) {
    st.xp -= BALANCE.skillXpPerLevel(st.level);
    st.level += 1;
    notices.push({ tone: 'level', text: `${SKILL_NAMES[skill]} reached level ${st.level}!` });
  }
  return notices;
}

/** Current price of the next energy drink today (escalates per drink). */
export const drinkPrice = (drinksToday: number): number =>
  round2(BALANCE.drink.price * Math.pow(BALANCE.drink.priceGrowth, drinksToday));

/** Energy gained by sleeping now until 08:00, after any caffeine crash. */
export function sleepEnergyGain(s: GameState): { gain: number; crash: number; minutes: number } {
  const minutes = minutesUntilWake(s.minute);
  const crash = Math.max(0, s.drinksToday - 1) * BALANCE.drink.crashPerExtraDrink;
  const restored = (minutes / 60) * BALANCE.sleepEnergyPerHour;
  const after = clamp(Math.round(s.energy + restored) - crash, 0, BALANCE.maxEnergy);
  return { gain: after - s.energy, crash, minutes };
}

const blockedByGameOver = (s: GameState): ActionResult | null => (s.gameOver ? fail(s.gameOver) : null);

// ---------------- time ----------------

/** Advance the world clock, growing every published clip and settling money. */
export function advanceTime(s: GameState, minutes: number): Notice[] {
  const notices: Notice[] = [];
  if (!Number.isFinite(minutes) || minutes <= 0 || s.gameOver) return notices;
  let remaining = minutes;
  while (remaining > 0 && !s.gameOver) {
    const step = Math.min(remaining, 30);
    remaining -= step;
    const before = s.minute;
    const after = before + step;
    s.minute = after;

    // Day rollovers first so earnings land in the right bucket.
    for (let d = dayOf(before) + 1; d <= dayOf(after); d++) notices.push(...onNewDay(s, d));
    for (let d = streamDayOf(before) + 1; d <= streamDayOf(after); d++) onNewStreamDay(s, d);
    if (s.gameOver) break;

    notices.push(...checkMonetization(s));
    const daily = ensureDaily(s, dayOf(after));
    for (const clip of s.published) {
      const v = viewsAt(clip, after);
      const dv = v - clip.views;
      if (dv > 0) {
        const acct = s.platforms[clip.platform];
        const p = PLATFORMS[clip.platform];
        const prevViews = clip.views;
        clip.views = v;
        clip.likes = Math.round(v * clip.likeRate);
        clip.comments = Math.round(v * clip.commentRate);
        clip.shares = Math.round(v * clip.shareRate);
        const newFollowers = Math.round(v * clip.followRate);
        const df = newFollowers - clip.followersGained;
        clip.followersGained = newFollowers;
        acct.followers += df;
        acct.totalViews += dv;
        daily.views += dv;
        daily.followers += df;
        if (acct.monetized) {
          const earned = (dv * p.monetization.rpm) / 1000;
          clip.revenue = round4(clip.revenue + earned);
          acct.revenue = round4(acct.revenue + earned);
          daily.revenue = round4(daily.revenue + earned);
          receiveIncome(s, earned, `${p.name} revenue`);
        }
        for (const ms of VIEW_MILESTONES) {
          if (prevViews < ms && v >= ms) notices.push({ tone: 'good', text: `"${short(clip.title)}" passed ${ms.toLocaleString()} views on ${p.name}!` });
        }
        recordHistory(clip, after, v);
      }
      if (!clip.repApplied && after - clip.publishedAtMinute > clip.tau * 3) notices.push(...settleReputation(s, clip));
    }

    notices.push(...checkMonetization(s));
  }
  return notices;
}

function recordHistory(clip: PublishedClip, minute: number, views: number): void {
  // Stop sampling once the clip has settled; its curve is flat from there on.
  if (isSettled(clip, minute)) return;
  const last = clip.history[clip.history.length - 1];
  if (last && minute - last.minute < 60) return;
  clip.history.push({ minute, views });
  if (clip.history.length > BALANCE.historyCap) {
    // Halve resolution uniformly, always keeping the first and latest points.
    const lastIdx = clip.history.length - 1;
    clip.history = clip.history.filter((_, i) => i % 2 === 0 || i === lastIdx);
  }
}

/** Reputation follows how a clip performed against expectations, with diminishing gains. */
function settleReputation(s: GameState, clip: PublishedClip): Notice[] {
  clip.repApplied = true;
  const expected = Math.max(1, clip.expectedViews ?? clip.targetViews);
  const ratio = Math.max(0.05, clip.views / expected);
  const { maxGainPerClip, maxLossPerClip } = BALANCE.reputation;
  let delta = clamp(Math.log2(ratio) * 1.2 + (clip.quality - 50) / 40, -maxLossPerClip, maxGainPerClip);
  if (delta > 0) delta *= Math.max(0, 1 - s.reputation / 110);
  s.reputation = clamp(round2(s.reputation + delta), 0, 100);
  if (delta <= -1) return [{ tone: 'bad', text: `"${short(clip.title)}" flopped. Reputation −${Math.abs(delta).toFixed(1)}.` }];
  if (delta >= 1.5) return [{ tone: 'good', text: `"${short(clip.title)}" beat expectations. Reputation +${delta.toFixed(1)}.` }];
  return [];
}

/** Unlock monetization on platforms whose rules are now met. */
export function checkMonetization(s: GameState): Notice[] {
  const notices: Notice[] = [];
  for (const id of PLATFORM_IDS) {
    const acct = s.platforms[id];
    const p = PLATFORMS[id];
    if (!acct.monetized && monetizationEligible(acct, p)) {
      acct.monetized = true;
      acct.monetizedAtMinute = s.minute;
      if (p.monetization.minFollowers > 0 || p.monetization.minTotalViews > 0)
        notices.push({ tone: 'good', text: `${p.name} monetization unlocked! (${p.monetization.programName})` });
    }
  }
  return notices;
}

function receiveIncome(s: GameState, amount: number, label: string): void {
  if (amount <= 0) return;
  let net = amount;
  if (s.rentOwed > 0) {
    const pay = Math.min(s.rentOwed, net);
    s.rentOwed = round4(s.rentOwed - pay);
    net -= pay;
    if (s.rentOwed <= 0) {
      s.rentOwed = 0;
      s.missedRent = 0;
    }
  }
  s.cash = round4(s.cash + net);
  addLedger(s, amount, label, 'income');
}

function onNewDay(s: GameState, day: number): Notice[] {
  const notices: Notice[] = [];
  const daily = ensureDaily(s, day);
  s.reputation = round2(s.reputation * (1 - BALANCE.reputation.dailyDecay));
  if ((day - 1) % BALANCE.rent.everyDays === 0 && day > 1) {
    const { amount: rent, lateFee, evictAfterMissed } = BALANCE.rent;
    const paid = Math.min(s.cash, rent);
    s.cash = round4(s.cash - paid);
    daily.expenses += paid;
    addLedger(s, paid, 'Room rent', 'expense');
    const short = rent - paid;
    if (short > 0 || s.rentOwed > 0) {
      s.rentOwed = round4(s.rentOwed + short + lateFee);
      s.missedRent += 1;
      if (s.missedRent >= evictAfterMissed) {
        s.gameOver = `Evicted: you missed rent ${s.missedRent} weeks running and owed $${s.rentOwed.toFixed(2)}.`;
        notices.push({ tone: 'bad', text: s.gameOver });
      } else if (s.missedRent === evictAfterMissed - 1) {
        notices.push({ tone: 'bad', text: `Landlord: "Last warning. Clear your $${s.rentOwed.toFixed(2)} debt before next rent day or you're out."` });
      } else {
        notices.push({ tone: 'bad', text: `Rent: $${short.toFixed(2)} short. A $${lateFee} late fee was added; debt comes out of future earnings.` });
      }
    } else {
      notices.push({ tone: 'info', text: `Paid $${rent} weekly rent.` });
    }
  }
  return notices;
}

/** At 08:00 yesterday's VODs expire: drop their scans and used-moment ids; reset drinks. */
function onNewStreamDay(s: GameState, streamDay: number): void {
  s.drinksToday = 0;
  for (const key of Object.keys(s.scanned)) {
    const d = Number(key.split(':d')[1]);
    if (!Number.isFinite(d) || d < streamDay) delete s.scanned[key];
  }
  const inQueue = new Set(s.drafts.map((d) => d.moment.id));
  s.usedMomentIds = s.usedMomentIds.filter((id) => {
    const m = /-d(\d+)-/.exec(id);
    return inQueue.has(id) || !m || Number(m[1]) >= streamDay;
  });
}

// ---------------- actions ----------------

export function scanSegment(s: GameState, streamerId: string, segIndex: number): ActionResult {
  const over = blockedByGameOver(s);
  if (over) return over;
  const streamer = STREAMER_BY_ID[streamerId];
  if (!streamer) return fail('Unknown streamer.');
  const day = streamDayOf(s.minute);
  const session = getSession(s.worldSeed, streamer, day);
  const seg = session.segments[segIndex];
  if (!seg) return fail('That segment does not exist.');
  if (!segmentAired(seg, s.minute)) return fail('That part of the stream has not aired yet.');
  const key = session.key;
  if ((s.scanned[key] ?? []).includes(segIndex)) return fail('You already scanned that segment.');
  if (s.energy < BALANCE.scan.energy) return fail('Too tired to focus. Grab a drink or sleep.');
  if (streamDayOf(s.minute + BALANCE.scan.minutes) !== day)
    return fail(`Today's VODs expire at 0${BALANCE.wakeHour}:00 — not enough time left to scan.`);

  s.energy -= BALANCE.scan.energy;
  s.scanned[key] = [...(s.scanned[key] ?? []), segIndex];
  s.stats.segmentsScanned += 1;
  const notices: Notice[] = [];
  notices.push(...completeObjective(s, 'scan-stream'));
  notices.push(...addSkillXp(s, 'trendSense', 6 + seg.momentIds.length * 4));
  notices.push(...addXp(s, 4));
  notices.push(...advanceTime(s, BALANCE.scan.minutes));
  notices.unshift(
    seg.momentIds.length === 0
      ? { tone: 'info', text: 'Nothing clip-worthy in that half hour. Chat was just vibing.' }
      : { tone: 'good', text: `Found ${seg.momentIds.length} moment${seg.momentIds.length > 1 ? 's' : ''}!` },
  );
  return ok(notices);
}

export function startDraft(s: GameState, streamerId: string, day: number, momentId: string, draftId: string): ActionResult {
  const over = blockedByGameOver(s);
  if (over) return over;
  const streamer = STREAMER_BY_ID[streamerId];
  if (!streamer) return fail('Unknown streamer.');
  if (day !== streamDayOf(s.minute)) return fail("That stream's VOD has expired.");
  const session = getSession(s.worldSeed, streamer, day);
  const moment = session.moments[momentId];
  if (!moment) return fail('That moment no longer exists.');
  const scanned = s.scanned[sessionKey(streamerId, day)] ?? [];
  if (!scanned.includes(moment.segmentIndex)) return fail('Scan that segment first.');
  if (s.usedMomentIds.includes(momentId)) return fail('You already clipped that moment.');
  if (s.drafts.filter((d) => d.status !== 'published').length >= 6) return fail('Your edit queue is full (6). Publish or discard something first.');

  const titles = titleSuggestions(moment, streamer.name);
  const draft: ClipDraft = {
    id: draftId,
    moment: JSON.parse(JSON.stringify(moment)) as typeof moment,
    createdAtMinute: s.minute,
    trimStart: 0,
    trimEnd: moment.rawLength,
    title: titles.descriptive,
    titleStyle: 'descriptive',
    hook: 'none',
    subtitles: 'none',
    effects: [],
    thumbnail: 'action',
    status: 'editing',
    quality: null,
    xpAwarded: false,
  };
  s.drafts.push(draft);
  s.usedMomentIds.push(momentId);
  completeObjective(s, 'select-moment');
  return ok([{ tone: 'info', text: 'Moment sent to the Clip Studio.' }]);
}

export type DraftPatch = Partial<Pick<ClipDraft, 'trimStart' | 'trimEnd' | 'title' | 'titleStyle' | 'hook' | 'subtitles' | 'effects' | 'thumbnail'>>;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function updateDraft(s: GameState, draftId: string, patch: DraftPatch): ActionResult {
  const d = s.drafts.find((x) => x.id === draftId);
  if (!d) return fail('Draft not found.');
  if (d.status !== 'editing') return fail('Re-open the clip to edit it.');
  const raw = d.moment.rawLength;
  const start = finite(patch.trimStart) ? clamp(Math.round(patch.trimStart), 0, raw - 5) : d.trimStart;
  const end = finite(patch.trimEnd) ? clamp(Math.round(patch.trimEnd), 5, raw) : d.trimEnd;
  if (end - start >= 5) {
    d.trimStart = start;
    d.trimEnd = end;
  } else if (finite(patch.trimStart) && !finite(patch.trimEnd)) {
    d.trimStart = Math.max(0, end - 5);
    d.trimEnd = end;
  } else {
    d.trimStart = start;
    d.trimEnd = Math.min(raw, start + 5);
  }
  if (typeof patch.title === 'string') {
    d.title = patch.title.slice(0, 80);
    // The style always reflects what the title actually says.
    d.titleStyle = inferTitleStyle(d.title);
  }
  if (patch.hook) d.hook = patch.hook;
  if (patch.subtitles) d.subtitles = patch.subtitles;
  if (Array.isArray(patch.effects)) d.effects = Array.from(new Set(patch.effects)).slice(0, 5);
  if (patch.thumbnail) d.thumbnail = patch.thumbnail;
  return ok();
}

export function finishDraft(s: GameState, draftId: string): ActionResult {
  const over = blockedByGameOver(s);
  if (over) return over;
  const d = s.drafts.find((x) => x.id === draftId);
  if (!d) return fail('Draft not found.');
  if (d.status !== 'editing') return fail('That clip is already finished.');
  const streamer = getStreamer(d.moment.streamerId);
  const q = computeQuality(d, { editingLevel: s.skills.editing.level, maxEffects: maxEffectsFor(s.equipment), streamerName: streamer.name });
  if (!q.valid) return fail(q.errors[0] ?? 'Clip is not valid yet.');
  if (s.energy < BALANCE.finishEdit.energy) return fail('Too tired to edit. Grab a drink or sleep.');
  s.energy -= BALANCE.finishEdit.energy;
  d.status = 'ready';
  d.quality = q.total;
  const notices: Notice[] = [{ tone: 'good', text: `Clip rendered! Edit quality ${q.total}/100. Ready to publish.` }];
  completeObjective(s, 'finish-edit');
  if (!d.xpAwarded) {
    // XP once per draft: re-rendering can improve the clip but cannot farm skill.
    d.xpAwarded = true;
    s.stats.clipsEdited += 1;
    notices.push(...addSkillXp(s, 'editing', 10 + q.total / 6));
    notices.push(...addXp(s, 8));
  }
  notices.push(...advanceTime(s, BALANCE.finishEdit.minutes));
  return ok(notices);
}

export function reopenDraft(s: GameState, draftId: string): ActionResult {
  const d = s.drafts.find((x) => x.id === draftId);
  if (!d) return fail('Draft not found.');
  if (d.status !== 'ready') return fail('Only finished, unpublished clips can be re-opened.');
  d.status = 'editing';
  d.quality = null;
  return ok([{ tone: 'info', text: 'Clip re-opened. Rendering again costs energy but gives no extra XP.' }]);
}

export function discardDraft(s: GameState, draftId: string): ActionResult {
  const i = s.drafts.findIndex((x) => x.id === draftId);
  const d = s.drafts[i];
  if (!d) return fail('Draft not found.');
  if (d.status === 'published') return fail('Published clips cannot be discarded.');
  s.drafts.splice(i, 1);
  s.usedMomentIds = s.usedMomentIds.filter((id) => id !== d.moment.id);
  return ok([{ tone: 'info', text: 'Draft discarded.' }]);
}

/** Clips of a category on a platform published within the fatigue window. */
export function recentSameCategory(s: GameState, platform: PlatformId, category: ClipDraft['moment']['category']): number {
  return s.published.filter(
    (c) => c.platform === platform && c.category === category && s.minute - c.publishedAtMinute < BALANCE.fatigueWindowMinutes,
  ).length;
}

export function publishClip(s: GameState, draftId: string, platform: PlatformId, clipId: string): ActionResult {
  const over = blockedByGameOver(s);
  if (over) return over;
  const i = s.drafts.findIndex((x) => x.id === draftId);
  const d = s.drafts[i];
  if (!d) return fail('Clip not found.');
  if (d.status !== 'ready' || d.quality === null) return fail('Finish editing the clip first.');
  if (!PLATFORM_IDS.includes(platform)) return fail('Unknown platform.');
  if (s.energy < BALANCE.publish.energy) return fail('Too tired to even press upload. Rest first.');

  const streamer = getStreamer(d.moment.streamerId);
  // Luck is fixed per draft: publish order and save/reload cannot steer it.
  const rng = seeded(s.worldSeed, 'publish', d.id);
  const clip = simulatePublish({
    id: clipId,
    draft: d,
    quality: d.quality,
    platform,
    streamer,
    account: s.platforms[platform],
    reputation: s.reputation,
    trends: generateTrends(s.worldSeed, streamDayOf(s.minute)),
    now: s.minute,
    recentSameCategory: recentSameCategory(s, platform, d.moment.category),
    rng,
  });
  s.energy -= BALANCE.publish.energy;
  // The published clip holds everything we need; drop the draft so saves stay small.
  s.drafts.splice(i, 1);
  s.published.push(clip);
  s.stats.clipsPublished += 1;
  ensureDaily(s, dayOf(s.minute)).clipsPublished += 1;

  const p = PLATFORMS[platform];
  const notices: Notice[] = [{ tone: 'good', text: `Published "${short(clip.title)}" on ${p.name}.` }];
  if (clip.factors.viral) {
    s.stats.viralClips += 1;
    notices.push({ tone: 'viral', text: `The ${p.name} algorithm is pushing your clip HARD. It's going viral!` });
  }
  if ((clip.factors.fatigue ?? 1) < 0.9)
    notices.push({ tone: 'info', text: `${p.name} viewers have seen a lot of this kind of clip today — reach is down.` });
  if (d.quality < 35) {
    s.reputation = clamp(round2(s.reputation - 1), 0, 100);
    notices.push({ tone: 'bad', text: 'Viewers called it low-effort. Reputation dipped.' });
  }
  completeObjective(s, 'publish');
  notices.push(...addXp(s, 15 + d.quality / 5));
  notices.push(...advanceTime(s, BALANCE.publish.minutes));
  return ok(notices);
}

export function sleep(s: GameState): ActionResult {
  const over = blockedByGameOver(s);
  if (over) return over;
  const { gain, crash, minutes } = sleepEnergyGain(s);
  const target = s.energy + gain;
  const before = { cash: s.cash, followers: totalFollowers(s) };
  const notices = advanceTime(s, minutes);
  s.energy = target;
  const earned = s.cash - before.cash;
  const gained = totalFollowers(s) - before.followers;
  notices.unshift({
    tone: 'info',
    text: `Good morning! Day ${dayOf(s.minute)}. Overnight: +${gained} followers, ${earned >= 0 ? '+' : '-'}$${Math.abs(earned).toFixed(2)}.${crash > 0 ? ` Caffeine crash: −${crash} energy.` : ''}`,
  });
  return ok(notices);
}

export function buyDrink(s: GameState): ActionResult {
  const over = blockedByGameOver(s);
  if (over) return over;
  const { energy, maxPerDay } = BALANCE.drink;
  const price = drinkPrice(s.drinksToday);
  if (s.drinksToday >= maxPerDay) return fail('Your heart says no more energy drinks today.');
  if (s.energy >= BALANCE.maxEnergy) return fail('You are already fully charged.');
  if (s.cash < price) return fail(`You need $${price.toFixed(2)} for a drink.`);
  const gained = Math.min(energy, BALANCE.maxEnergy - s.energy);
  s.cash = round4(s.cash - price);
  s.drinksToday += 1;
  s.energy += gained;
  ensureDaily(s, dayOf(s.minute)).expenses += price;
  addLedger(s, price, 'Energy drinks', 'expense');
  const left = maxPerDay - s.drinksToday;
  return ok([
    {
      tone: 'good',
      text: `+${gained} energy. (${left} left today${s.drinksToday >= 2 ? ' — expect a crash tomorrow morning' : ''})`,
    },
  ]);
}

export function petCat(s: GameState): ActionResult {
  if (s.minute - s.lastPetMinute < BALANCE.pet.cooldownMinutes) return ok([{ tone: 'info', text: 'Byte is napping. Let them be.' }]);
  s.lastPetMinute = s.minute;
  const gained = Math.min(BALANCE.pet.energy, BALANCE.maxEnergy - s.energy);
  s.energy += gained;
  return ok([{ tone: 'good', text: gained > 0 ? `Byte purrs. +${gained} energy.` : 'Byte purrs.' }]);
}

export const totalFollowers = (s: GameState): number => PLATFORM_IDS.reduce((a, p) => a + s.platforms[p].followers, 0);
export const totalViews = (s: GameState): number => PLATFORM_IDS.reduce((a, p) => a + s.platforms[p].totalViews, 0);

const round2 = (v: number): number => Math.round(v * 100) / 100;
const round4 = (v: number): number => Math.round(v * 10000) / 10000;
const short = (t: string): string => {
  const s = typeof t === 'string' ? t : 'Untitled';
  return s.length > 32 ? `${s.slice(0, 30)}…` : s;
};
