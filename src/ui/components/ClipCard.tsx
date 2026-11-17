import { CATEGORY_COLOR, EFFECTS } from '../../data/editorOptions';
import { findStreamer } from '../../data/streamers';
import type { ClipDraft } from '../../types/game';
import { Portrait } from './Portrait';

/** Representative preview card for a clip (thumbnail + caption + title). */
export function ClipCard({
  draft,
  compact = false,
  caption,
  flash = false,
  quality,
  preview = false,
}: {
  draft: ClipDraft;
  compact?: boolean;
  caption?: string | null;
  flash?: boolean;
  quality?: number;
  /** Playback preview: always show what is being said, even without subtitles. */
  preview?: boolean;
}): JSX.Element {
  const s = findStreamer(draft.moment.streamerId);
  const color = CATEGORY_COLOR[draft.moment.category];
  const captionText = preview
    ? caption ?? null
    : draft.subtitles !== 'none'
      ? caption ?? draft.moment.quote.split(' ').slice(0, 5).join(' ')
      : null;
  const text = draft.moment.quote.split(' ').slice(0, 4).join(' ').toUpperCase();
  return (
    <div className={`clipcard${compact ? ' compact' : ''}${flash ? ' flash' : ''}`} style={{ ['--cat' as string]: color }}>
      <div className={`cc-thumb thumb-${draft.thumbnail}`}>
        {draft.thumbnail === 'reaction' && (
          <>
            <Portrait p={s.portrait} size={compact ? 56 : 96} />
            <span className="cc-burst">!!</span>
          </>
        )}
        {draft.thumbnail === 'action' && (
          <div className="cc-scene" aria-hidden>
            <span className="cc-sky" />
            <span className="cc-ground" />
            <span className="cc-hero" />
            <span className="cc-spark" />
          </div>
        )}
        {draft.thumbnail === 'text-heavy' && <span className="cc-bigtext">{text}</span>}
        {!compact && draft.hook !== 'none' && <span className="cc-hook">{draft.hook === 'countdown' ? '3…2…1' : draft.hook === 'text-teaser' ? 'WAIT FOR IT' : 'PEAK FIRST'}</span>}
        {!compact && captionText && (
          <span className={`cc-caption sub-${draft.subtitles}`}>{draft.subtitles === 'none' ? `(audio) ${captionText}` : captionText}</span>
        )}
      </div>
      {!compact && (
        <div className="cc-meta">
          <b className="cc-title">{draft.title || 'Untitled clip'}</b>
          <span className="muted small">
            {s.name} · {draft.trimEnd - draft.trimStart}s{quality !== undefined ? ` · Q${quality}` : ''}
          </span>
          {draft.effects.length > 0 && (
            <span className="cc-fx">
              {draft.effects.map((id) => (
                <i key={id}>{EFFECTS.find((e) => e.id === id)?.label}</i>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
