import type { EffectId, HookId, MomentCategory, SubtitleId, ThumbnailId, TitleStyle } from '../types/game';

type Affinity = Record<MomentCategory, number>; // 0–100 suitability score

export interface OptionDef<Id extends string> {
  id: Id;
  label: string;
  description: string;
  affinity: Affinity;
}

const aff = (
  funny: number,
  rage: number,
  emotional: number,
  unexpected: number,
  controversial: number,
  gameplay: number,
  quote: number,
): Affinity => ({ funny, rage, emotional, unexpected, controversial, gameplay, quote });

export const TITLE_STYLES: OptionDef<TitleStyle>[] = [
  { id: 'hype', label: 'Hype', description: 'ALL-CAPS energy. Great for chaos, cringe for feelings.', affinity: aff(85, 95, 35, 85, 70, 75, 50) },
  { id: 'descriptive', label: 'Descriptive', description: 'Clear and searchable. Safe everywhere.', affinity: aff(65, 60, 80, 60, 65, 90, 65) },
  { id: 'question', label: 'Question', description: 'Curiosity gap. Strong for surprises and debates.', affinity: aff(70, 60, 70, 90, 90, 60, 70) },
  { id: 'quote', label: 'Quote', description: 'Lead with the line itself. Best when the words carry it.', affinity: aff(70, 55, 75, 50, 80, 40, 98) },
];

export const HOOKS: OptionDef<HookId>[] = [
  { id: 'cold-open', label: 'Cold open', description: 'Flash the peak first, then rewind.', affinity: aff(85, 95, 50, 70, 70, 90, 60) },
  { id: 'text-teaser', label: 'Text teaser', description: '"Wait for it..." caption over the build-up.', affinity: aff(75, 65, 75, 95, 70, 65, 70) },
  { id: 'countdown', label: 'Countdown', description: 'On-screen timer to the moment. Builds tension.', affinity: aff(60, 70, 40, 80, 50, 85, 40) },
  { id: 'none', label: 'No hook', description: 'Let it play naturally. Works for slow, sincere moments.', affinity: aff(35, 35, 80, 30, 50, 40, 70) },
];

export interface SubtitleDef extends OptionDef<SubtitleId> {
  base: number;
  minEditingLevel: number;
}

export const SUBTITLES: SubtitleDef[] = [
  { id: 'none', label: 'None', description: 'No captions. Most viewers watch muted.', base: 20, minEditingLevel: 1, affinity: aff(30, 40, 30, 35, 25, 50, 10) },
  { id: 'basic', label: 'Basic white', description: 'Clean white captions. Reliable.', base: 70, minEditingLevel: 1, affinity: aff(70, 70, 80, 70, 75, 70, 80) },
  { id: 'bold-pop', label: 'Bold pop', description: 'Big animated words. Loud and fun.', base: 80, minEditingLevel: 1, affinity: aff(95, 90, 45, 90, 75, 80, 80) },
  { id: 'karaoke', label: 'Karaoke highlight', description: 'Word-by-word highlight. Polished and premium.', base: 92, minEditingLevel: 2, affinity: aff(85, 80, 90, 85, 90, 75, 98) },
];

export interface EffectDef extends OptionDef<EffectId> {
  /** Positive/negative delta per category when applied. */
  delta: Record<MomentCategory, number>;
}

const delta = aff;

export const EFFECTS: EffectDef[] = [
  { id: 'zoom-punch', label: 'Zoom punch', description: 'Snap zoom on the peak.', affinity: aff(0, 0, 0, 0, 0, 0, 0), delta: delta(10, 14, -10, 10, 4, 8, 4) },
  { id: 'sound-fx', label: 'Sound FX', description: 'Boings, booms and record scratches.', affinity: aff(0, 0, 0, 0, 0, 0, 0), delta: delta(14, 6, -14, 8, -4, 4, -2) },
  { id: 'slow-mo', label: 'Slow-mo replay', description: 'Replay the peak at half speed.', affinity: aff(0, 0, 0, 0, 0, 0, 0), delta: delta(4, 6, 6, 12, -2, 14, -6) },
  { id: 'meme-overlay', label: 'Meme overlay', description: 'Reaction stickers on screen.', affinity: aff(0, 0, 0, 0, 0, 0, 0), delta: delta(12, 8, -18, 4, 6, 0, -4) },
  { id: 'color-grade', label: 'Color grade', description: 'Moody cinematic look.', affinity: aff(0, 0, 0, 0, 0, 0, 0), delta: delta(0, 2, 12, 2, 4, 6, 6) },
];

export const THUMBNAILS: OptionDef<ThumbnailId>[] = [
  { id: 'reaction', label: 'Reaction face', description: 'Streamer mid-scream or mid-laugh.', affinity: aff(90, 95, 75, 85, 70, 55, 65) },
  { id: 'action', label: 'Action frame', description: 'The key frame of the moment itself.', affinity: aff(60, 65, 55, 80, 50, 95, 40) },
  { id: 'text-heavy', label: 'Big text', description: 'Giant caption with the hook line.', affinity: aff(65, 60, 70, 60, 90, 55, 95) },
];

export const CATEGORY_LABEL: Record<MomentCategory, string> = {
  funny: 'Funny',
  rage: 'Rage',
  emotional: 'Emotional',
  unexpected: 'Unexpected',
  controversial: 'Controversial',
  gameplay: 'Gameplay',
  quote: 'Memorable quote',
};

export const CATEGORY_COLOR: Record<MomentCategory, string> = {
  funny: '#ffd166',
  rage: '#ff5470',
  emotional: '#7ee0c8',
  unexpected: '#b388ff',
  controversial: '#ff8a3d',
  gameplay: '#4fd8e8',
  quote: '#f4f1ff',
};

export const MOMENT_CATEGORIES: MomentCategory[] = [
  'funny',
  'rage',
  'emotional',
  'unexpected',
  'controversial',
  'gameplay',
  'quote',
];
