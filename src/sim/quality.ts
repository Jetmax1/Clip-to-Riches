// Editing quality calculation. Pure function of the draft + player skill + equipment limits.
//
// Design notes (from review):
// - Every moment has hidden "taste" offsets per option, so there is no single fixed
//   best setup per category. The UI shows fuzzy tiers, sharpened by Editing level.
// - The title is scored on its actual text (style inferred from the text, relevance to
//   the moment, gibberish penalty), not on the label of the style card that was clicked.
// - Lead-in / tail tolerances scale with the moment's ideal length so long-form moments
//   (emotional, controversial) can still get a perfect cut.

import { BALANCE } from '../data/balance';
import { EFFECTS, HOOKS, SUBTITLES, THUMBNAILS, TITLE_STYLES } from '../data/editorOptions';
import type { ClipDraft, MomentCategory, QualityBreakdown, QualityPart, TitleStyle } from '../types/game';
import { clamp, hashString, Rng } from './rng';

export interface QualityContext {
  editingLevel: number;
  maxEffects: number;
  streamerName: string;
}

export const WEIGHTS = { trim: 0.32, title: 0.16, hook: 0.16, subtitles: 0.14, effects: 0.1, thumbnail: 0.12 } as const;

/** Base ideal clip length per category; individual moments vary ±20% around this. */
export const CATEGORY_IDEAL_LENGTH: Record<MomentCategory, number> = {
  funny: 20,
  rage: 24,
  emotional: 42,
  unexpected: 22,
  controversial: 34,
  gameplay: 30,
  quote: 18,
};

export function skillMultiplier(editingLevel: number): number {
  return Math.min(1.12, 0.78 + 0.04 * (editingLevel - 1));
}

/** Deterministic hidden per-moment preference shift for one editor option, in ±spread. */
export function momentTaste(momentId: string, kind: string, optionId: string): number {
  const r = new Rng(hashString(`${momentId}|taste|${kind}|${optionId}`));
  return Math.round((r.next() * 2 - 1) * BALANCE.momentTasteSpread);
}

/** Infer the title's style from what it actually says. */
export function inferTitleStyle(text: string): TitleStyle {
  const t = text.trim();
  if (/^["'“‘].*["'”’]$/.test(t)) return 'quote';
  if (t.endsWith('?')) return 'question';
  const letters = t.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 6 && letters === letters.toUpperCase()) return 'hype';
  return 'descriptive';
}

const WORD = /[a-z']{4,}/g;

/** 0–1 overlap between the title's meaningful words and the moment's own words. */
function relevance(title: string, draft: ClipDraft, streamerName: string): number {
  const words = new Set((title.toLowerCase().match(WORD) ?? []).filter((w) => w !== streamerName.toLowerCase()));
  if (words.size === 0) return 0;
  const source = new Set(`${draft.moment.subject} ${draft.moment.quote} ${draft.moment.description}`.toLowerCase().match(WORD) ?? []);
  let hit = 0;
  for (const w of words) if (source.has(w)) hit++;
  return Math.min(1, hit / Math.min(3, words.size));
}

/** True for keyboard-mash text: few vowels, or long consonant runs. */
export function looksLikeGibberish(text: string): boolean {
  const letters = text.toLowerCase().replace(/[^a-z]/g, '');
  if (letters.length < 6) return false;
  const vowels = (letters.match(/[aeiouy]/g) ?? []).length;
  return vowels / letters.length < 0.2 || /[^aeiouy\s]{6,}/.test(letters);
}

export function computeQuality(draft: ClipDraft, ctx: QualityContext): QualityBreakdown {
  const m = draft.moment;
  const errors: string[] = [];
  const len = draft.trimEnd - draft.trimStart;
  if (!(draft.trimStart >= 0 && draft.trimEnd <= m.rawLength && len > 0)) errors.push('Trim points are out of range.');
  if (len < 5) errors.push('Clip must be at least 5 seconds long.');
  const title = draft.title.trim();
  if (title.length === 0) errors.push('Give the clip a title.');
  if (title.length > 80) errors.push('Title is too long (80 characters max).');
  if (draft.effects.length > ctx.maxEffects) errors.push(`Your laptop can only render ${ctx.maxEffects} effects.`);
  const sub = SUBTITLES.find((s) => s.id === draft.subtitles);
  if (sub && ctx.editingLevel < sub.minEditingLevel) errors.push(`${sub.label} subtitles need Editing level ${sub.minEditingLevel}.`);

  const taste = (kind: string, id: string): number => momentTaste(m.id, kind, id);

  // --- Trim ---
  const beatIn = m.beatAt >= draft.trimStart + 1 && m.beatAt <= draft.trimEnd - 1;
  let trim: number;
  let trimTip: string;
  if (!beatIn) {
    trim = 5;
    trimTip = 'The key beat is cut out — viewers will see nothing happen.';
  } else {
    const lengthScore = clamp(100 - (Math.abs(len - m.idealLength) / m.idealLength) * 120, 0, 100);
    const lead = m.beatAt - draft.trimStart;
    const tail = draft.trimEnd - m.beatAt;
    const leadMax = Math.max(10, m.idealLength * 0.45);
    const tailMax = Math.max(9, m.idealLength * 0.6);
    const leadScore = lead < 2 ? 70 : lead <= leadMax ? 100 : clamp(100 - (lead - leadMax) * 4, 20, 100);
    const tailScore = tail < 1.5 ? 70 : tail <= tailMax ? 100 : clamp(100 - (tail - tailMax) * 3, 25, 100);
    trim = 0.5 * lengthScore + 0.25 * leadScore + 0.25 * tailScore;
    trimTip =
      lengthScore < 60
        ? len > m.idealLength
          ? 'Too long — viewers drift off. Tighten the cut.'
          : 'Too short — the moment needs room to land.'
        : leadScore < 80
          ? 'Too much build-up before the peak.'
          : tailScore < 80
            ? 'The reaction drags on after the peak.'
            : lengthScore < 85
              ? 'Close — nudge the length a little.'
              : 'Tight cut. The peak lands well.';
  }

  // --- Title (scored on the text itself) ---
  const style = inferTitleStyle(title);
  const styleDef = TITLE_STYLES.find((t) => t.id === style) ?? TITLE_STYLES[1]!;
  let titleScore = styleDef.affinity[m.category] + taste('title', style);
  const rel = relevance(title, draft, ctx.streamerName);
  // Descriptive titles must describe the moment; every style earns a bonus for relevant words.
  titleScore += Math.round(rel * 10) - (style === 'descriptive' && rel < 0.2 ? 10 : 0);
  if (title.length > 0 && title.length < 12) titleScore -= 25;
  if (title.length > 65) titleScore -= 20;
  if (looksLikeGibberish(title)) titleScore -= 45;
  if (title.toLowerCase().includes(ctx.streamerName.toLowerCase())) titleScore += 4;
  titleScore = clamp(titleScore, 0, 100);
  const titleTip =
    looksLikeGibberish(title)
      ? 'Viewers can’t read this title.'
      : style === 'descriptive' && rel < 0.2
        ? 'The title doesn’t say what happens in the clip.'
        : tipFor(titleScore, `${styleDef.label.toLowerCase()}-style title`);

  // --- Hook ---
  const hook = HOOKS.find((h) => h.id === draft.hook) ?? HOOKS[3]!;
  const hookScore = clamp(hook.affinity[m.category] + taste('hook', hook.id), 0, 100);

  // --- Subtitles ---
  const subDef = sub ?? SUBTITLES[0]!;
  const subScore = clamp(subDef.base * 0.5 + subDef.affinity[m.category] * 0.5 + taste('sub', subDef.id) * 0.6, 0, 100);

  // --- Effects ---
  let fx = draft.effects.length === 0 ? 55 : 60;
  for (const id of draft.effects) {
    const def = EFFECTS.find((e) => e.id === id);
    if (def) fx += def.delta[m.category] + Math.round(taste('fx', id) * 0.5);
  }
  if (draft.effects.length >= 3) fx -= 12; // clutter
  fx = clamp(fx, 0, 100);

  // --- Thumbnail ---
  const thumb = THUMBNAILS.find((t) => t.id === draft.thumbnail) ?? THUMBNAILS[0]!;
  const thumbScore = clamp(thumb.affinity[m.category] + taste('thumb', thumb.id), 0, 100);

  const parts: QualityPart[] = [
    { id: 'trim', label: 'Cut & pacing', score: Math.round(trim), weight: WEIGHTS.trim, tip: trimTip },
    { id: 'title', label: 'Title', score: Math.round(titleScore), weight: WEIGHTS.title, tip: titleTip },
    { id: 'hook', label: 'Hook', score: Math.round(hookScore), weight: WEIGHTS.hook, tip: draft.hook === 'none' ? noneTip(hookScore, 'Letting it play') : tipFor(hookScore, 'hook') },
    { id: 'subtitles', label: 'Subtitles', score: Math.round(subScore), weight: WEIGHTS.subtitles, tip: draft.subtitles === 'none' ? 'No captions — most viewers watch muted.' : tipFor(subScore, 'subtitle style') },
    { id: 'effects', label: 'Effects', score: Math.round(fx), weight: WEIGHTS.effects, tip: draft.effects.length === 0 ? noneTip(fx, 'Going without effects') : tipFor(fx, 'effects mix') },
    { id: 'thumbnail', label: 'Thumbnail', score: Math.round(thumbScore), weight: WEIGHTS.thumbnail, tip: tipFor(thumbScore, 'thumbnail') },
  ];
  const raw = parts.reduce((a, p) => a + p.score * p.weight, 0);
  const mult = skillMultiplier(ctx.editingLevel);
  return {
    total: Math.round(clamp(raw * mult, 0, 100)),
    parts,
    skillMultiplier: mult,
    valid: errors.length === 0,
    errors,
  };
}

function tipFor(score: number, what: string): string {
  if (score >= 85) return `Great ${what} for this moment.`;
  if (score >= 65) return `Solid ${what}.`;
  if (score >= 45) return `This ${what} is an awkward fit.`;
  return `This ${what} works against the moment.`;
}

function noneTip(score: number, what: string): string {
  if (score >= 70) return `${what} suits this moment.`;
  if (score >= 50) return `${what} is fine, but something could lift it.`;
  return `${what} leaves this clip flat.`;
}

// ---------- Fuzzy readout (the editor only shows exact numbers at high Editing) ----------

export type QualityTier = 'Poor' | 'Weak' | 'Okay' | 'Good' | 'Great';

export function tierOf(score: number): QualityTier {
  return score >= 85 ? 'Great' : score >= 70 ? 'Good' : score >= 55 ? 'Okay' : score >= 40 ? 'Weak' : 'Poor';
}

/** ± uncertainty on the live quality estimate; 0 means exact. */
export function estimateSpread(editingLevel: number): number {
  return Math.max(0, 12 - 2 * (editingLevel - 1));
}

/** A stable, fuzzy range around the true total (does not jitter between renders). */
export function qualityRange(total: number, draftId: string, editingLevel: number): [number, number] {
  const spread = estimateSpread(editingLevel);
  if (spread === 0) return [total, total];
  const bias = new Rng(hashString(`${draftId}|qbias|${total}`)).next() * 2 - 1;
  const center = total + Math.round(bias * spread * 0.5);
  return [clamp(center - spread, 0, 100), clamp(center + spread, 0, 100)];
}

export const maxEffectsFor = (equipment: string[]): number =>
  equipment.includes('editing-rig') ? 4 : BALANCE.maxEffectsBasicLaptop;
