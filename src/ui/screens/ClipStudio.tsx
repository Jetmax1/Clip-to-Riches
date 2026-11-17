import { useEffect, useMemo, useState } from 'react';
import { BALANCE } from '../../data/balance';
import { CATEGORY_COLOR, EFFECTS, HOOKS, SUBTITLES, THUMBNAILS, TITLE_STYLES } from '../../data/editorOptions';
import { findStreamer } from '../../data/streamers';
import { CATEGORY_IDEAL_LENGTH, computeQuality, estimateSpread, inferTitleStyle, maxEffectsFor, qualityRange, tierOf } from '../../sim/quality';
import { titleSuggestions } from '../../sim/streams';
import { useGame } from '../../state/store';
import type { ClipDraft, EffectId, QualityBreakdown } from '../../types/game';
import { CategoryTag, Empty, Meter } from '../components/Bits';
import { ClipCard } from '../components/ClipCard';
import { ConfirmButton } from '../Modals';

const STEPS = ['Cut', 'Title & hook', 'Style', 'Thumbnail', 'Preview'] as const;
const TIER_MID = { Poor: 25, Weak: 47, Okay: 62, Good: 77, Great: 92 } as const;
const categoryName = (c: string): string => c.charAt(0).toUpperCase() + c.slice(1);

export function ClipStudio(): JSX.Element {
  const game = useGame((s) => s.game)!;
  const activeId = useGame((s) => s.ui.activeDraftId);
  const setActive = useGame((s) => s.setActiveDraft);
  const openPanel = useGame((s) => s.openPanel);
  const queue = game.drafts.filter((d) => d.status !== 'published');
  const active = queue.find((d) => d.id === activeId) ?? null;

  useEffect(() => {
    if (!active && queue.length > 0) setActive(queue[queue.length - 1]!.id);
  }, [active, queue, setActive]);

  return (
    <div className="studio">
      <aside className="queue" aria-label="Edit queue">
        <h3 className="col-title">Edit queue ({queue.length}/6)</h3>
        {queue.length === 0 && <p className="muted small">Empty. Find a moment in the Stream Browser.</p>}
        {queue.map((d) => (
          <button key={d.id} className={`queue-item${d.id === active?.id ? ' selected' : ''}`} onClick={() => setActive(d.id)} aria-pressed={d.id === active?.id}>
            <span className="qi-bar" style={{ background: CATEGORY_COLOR[d.moment.category] }} />
            <span className="qi-body">
              <span className="qi-title">{d.title || 'Untitled clip'}</span>
              <span className={`qi-status ${d.status}`}>{d.status === 'ready' ? `Ready · Q${d.quality}` : 'Editing'}</span>
            </span>
          </button>
        ))}
        <button className="btn ghost" onClick={() => openPanel('streams')}>+ Find more moments</button>
      </aside>
      <section className="editor">
        {active ? (
          active.status === 'editing' ? <Editor key={active.id} draft={active} /> : <ReadyView draft={active} />
        ) : (
          <Empty title="No clip selected">
            <p>Open the Stream Browser, scan a stream and pick a moment to start editing.</p>
            <button className="btn primary" onClick={() => openPanel('streams')}>Open Stream Browser</button>
          </Empty>
        )}
      </section>
    </div>
  );
}

function useQuality(draft: ClipDraft): QualityBreakdown {
  const editing = useGame((s) => s.game!.skills.editing.level);
  const equipment = useGame((s) => s.game!.equipment);
  const streamer = findStreamer(draft.moment.streamerId);
  return useMemo(
    () => computeQuality(draft, { editingLevel: editing, maxEffects: maxEffectsFor(equipment), streamerName: streamer.name }),
    [draft, editing, equipment, streamer.name],
  );
}

function Editor({ draft }: { draft: ClipDraft }): JSX.Element {
  const [step, setStep] = useState(0);
  const update = useGame((s) => s.updateDraft);
  const finish = useGame((s) => s.finishDraft);
  const discard = useGame((s) => s.discardDraft);
  const energy = useGame((s) => s.game!.energy);
  const editingLevel = useGame((s) => s.game!.skills.editing.level);
  const equipment = useGame((s) => s.game!.equipment);
  const q = useQuality(draft);
  const spread = estimateSpread(editingLevel);
  const exact = spread === 0;
  const [lo, hi] = qualityRange(q.total, draft.id, editingLevel);
  const streamer = findStreamer(draft.moment.streamerId);
  const m = draft.moment;
  const maxFx = maxEffectsFor(equipment);
  const patch = (p: Parameters<typeof update>[1]): void => update(draft.id, p);

  return (
    <div className="editor-grid">
      <div className="editor-main">
        <div className="ed-head">
          <CategoryTag c={m.category} />
          <span className="muted small">{streamer.name} · raw {m.rawLength}s</span>
        </div>
        <p className="m-desc">{m.description}</p>
        <nav className="steps" role="tablist" aria-label="Editing steps">
          {STEPS.map((s, i) => (
            <button key={s} role="tab" aria-selected={step === i} className={step === i ? 'active' : ''} onClick={() => setStep(i)}>
              <b>{i + 1}</b> {s}
            </button>
          ))}
        </nav>

        <div className="step-body" role="tabpanel">
          {step === 0 && <TrimStep draft={draft} onChange={patch} />}
          {step === 1 && (
            <>
              <h4>Title style</h4>
              <TitlePicker draft={draft} streamerName={streamer.name} onChange={patch} />
              <h4>Hook</h4>
              <div className="opt-grid">
                {HOOKS.map((h) => (
                  <OptionCard key={h.id} selected={draft.hook === h.id} title={h.label} desc={h.description} onClick={() => patch({ hook: h.id })} />
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h4>Subtitles</h4>
              <div className="opt-grid">
                {SUBTITLES.map((s) => {
                  const locked = editingLevel < s.minEditingLevel;
                  return (
                    <OptionCard
                      key={s.id}
                      selected={draft.subtitles === s.id}
                      title={s.label}
                      desc={locked ? `Locked — needs Editing Lv ${s.minEditingLevel}` : s.description}
                      disabled={locked}
                      onClick={() => patch({ subtitles: s.id })}
                    />
                  );
                })}
              </div>
              <h4>
                Effects <span className="muted">{draft.effects.length}/{maxFx} — your basic laptop can render {maxFx}</span>
              </h4>
              <div className="opt-grid">
                {EFFECTS.map((e) => {
                  const on = draft.effects.includes(e.id);
                  const full = !on && draft.effects.length >= maxFx;
                  return (
                    <OptionCard
                      key={e.id}
                      selected={on}
                      title={e.label}
                      desc={full ? 'Laptop at its effect limit' : e.description}
                      disabled={full}
                      toggle
                      onClick={() => patch({ effects: on ? draft.effects.filter((x) => x !== e.id) : [...draft.effects, e.id as EffectId] })}
                    />
                  );
                })}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h4>Thumbnail</h4>
              <div className="thumb-grid">
                {THUMBNAILS.map((t) => (
                  <button key={t.id} className={`thumb-opt${draft.thumbnail === t.id ? ' selected' : ''}`} onClick={() => patch({ thumbnail: t.id })} aria-pressed={draft.thumbnail === t.id}>
                    <ClipCard draft={{ ...draft, thumbnail: t.id }} compact />
                    <b>{t.label}</b>
                    <span className="muted small">{t.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 4 && <PreviewStep draft={draft} />}
        </div>

        <div className="step-nav">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
          <span />
          {step < STEPS.length - 1 ? (
            <button className="btn" onClick={() => setStep(step + 1)}>Next →</button>
          ) : (
            <span />
          )}
        </div>
      </div>

      <aside className="quality" aria-label="Edit quality">
        <div className="q-total">
          <span className="q-num">{exact ? q.total : `${lo}–${hi}`}</span>
          <span className="q-label">{exact ? 'Edit quality' : 'Estimated quality'}</span>
        </div>
        <p className="muted small">
          Editing Lv {editingLevel}: skill ×{q.skillMultiplier.toFixed(2)}
          {exact ? '' : ` · estimate ±${spread} (sharper with Editing level)`}
        </p>
        <ul className="q-parts">
          {q.parts.map((p) => {
            const tier = tierOf(p.score);
            // Below max skill the bars snap to tiers, so the exact optimum isn't readable.
            const shown = exact ? p.score : TIER_MID[tier];
            return (
              <li key={p.id}>
                <span className="qp-row">
                  <span>{p.label}</span>
                  <b>{exact ? p.score : tier}</b>
                </span>
                <Meter value={shown / 100} color={shown >= 75 ? '#5fd38a' : shown >= 50 ? '#ffd166' : '#ff5470'} label={`${p.label}: ${tier}`} />
                <span className="qp-tip">{p.tip}</span>
              </li>
            );
          })}
        </ul>
        {q.errors.length > 0 && (
          <ul className="errors" role="alert">
            {q.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <button
          className="btn primary big"
          disabled={!q.valid || energy < BALANCE.finishEdit.energy}
          onClick={() => finish(draft.id)}
          title={energy < BALANCE.finishEdit.energy ? 'Not enough energy' : 'Render the clip'}
        >
          Render clip
        </button>
        <p className="muted small center">Takes {BALANCE.finishEdit.minutes} min · {BALANCE.finishEdit.energy} energy</p>
        <div className="q-discard">
          <ConfirmButton className="btn danger ghost tiny" label="Discard draft" confirmLabel="Click again to discard" onConfirm={() => discard(draft.id)} />
        </div>
      </aside>
    </div>
  );
}

function TrimStep({ draft, onChange }: { draft: ClipDraft; onChange: (p: { trimStart?: number; trimEnd?: number }) => void }): JSX.Element {
  const m = draft.moment;
  const len = draft.trimEnd - draft.trimStart;
  return (
    <div className="trim">
      <p className="muted">Find the peak in the waveform and cut tight around it. Keep a little build-up and let the reaction land.</p>
      <div className="wave" aria-hidden>
        {m.intensity.map((v, i) => {
          const t = i * 5;
          const inside = t + 5 > draft.trimStart && t < draft.trimEnd;
          return <span key={i} className={inside ? 'in' : ''} style={{ height: `${Math.round(12 + v * 88)}%` }} />;
        })}
        <div
          className="wave-sel"
          style={{ left: `${(draft.trimStart / m.rawLength) * 100}%`, width: `${(len / m.rawLength) * 100}%` }}
        />
      </div>
      <div className="wave-scale" aria-hidden>
        <span>0s</span>
        <span>{Math.round(m.rawLength / 2)}s</span>
        <span>{m.rawLength}s</span>
      </div>
      <label className="range">
        <span>Start <b>{draft.trimStart}s</b></span>
        <input type="range" min={0} max={m.rawLength - 5} value={draft.trimStart} onChange={(e) => onChange({ trimStart: Number(e.target.value) })} />
      </label>
      <label className="range">
        <span>End <b>{draft.trimEnd}s</b></span>
        <input type="range" min={5} max={m.rawLength} value={draft.trimEnd} onChange={(e) => onChange({ trimEnd: Number(e.target.value) })} />
      </label>
      <p className="trim-len">
        Clip length <b>{len}s</b>{' '}
        <span className="muted small">
          · {categoryName(m.category)} moments usually land around {Math.round(CATEGORY_IDEAL_LENGTH[m.category] * 0.85)}–
          {Math.round(CATEGORY_IDEAL_LENGTH[m.category] * 1.2)}s
        </span>
      </p>
    </div>
  );
}

function TitlePicker({ draft, streamerName, onChange }: { draft: ClipDraft; streamerName: string; onChange: (p: { title?: string; titleStyle?: ClipDraft['titleStyle'] }) => void }): JSX.Element {
  const sugg = titleSuggestions(draft.moment, streamerName);
  const [pending, setPending] = useState<ClipDraft['titleStyle'] | null>(null);
  const custom = draft.title.trim() !== '' && !Object.values(sugg).includes(draft.title);
  const current = inferTitleStyle(draft.title);
  const pick = (id: ClipDraft['titleStyle']): void => {
    // Don't silently throw away a title the player typed.
    if (custom && pending !== id) {
      setPending(id);
      return;
    }
    setPending(null);
    onChange({ title: sugg[id] });
  };
  return (
    <>
      <p className="muted small">Pick a suggestion or write your own. The style is judged from what the title actually says.</p>
      <div className="opt-grid">
        {TITLE_STYLES.map((t) => (
          <OptionCard
            key={t.id}
            selected={current === t.id}
            title={pending === t.id ? `${t.label} — click again to replace your title` : t.label}
            desc={sugg[t.id]}
            onClick={() => pick(t.id)}
          />
        ))}
      </div>
      <label className="field">
        <span>Title text <span className="muted">({draft.title.length}/80)</span></span>
        <input
          type="text"
          maxLength={80}
          value={draft.title}
          onChange={(e) => {
            setPending(null);
            onChange({ title: e.target.value });
          }}
        />
      </label>
    </>
  );
}

function OptionCard(props: { selected: boolean; title: string; desc: string; onClick: () => void; disabled?: boolean; toggle?: boolean }): JSX.Element {
  return (
    <button
      className={`opt${props.selected ? ' selected' : ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.selected}
      role={props.toggle ? 'switch' : undefined}
      aria-checked={props.toggle ? props.selected : undefined}
    >
      <b>{props.toggle ? (props.selected ? '■ ' : '□ ') : ''}{props.title}</b>
      <span>{props.desc}</span>
    </button>
  );
}

function PreviewStep({ draft }: { draft: ClipDraft }): JSX.Element {
  const [t, setT] = useState<number | null>(null);
  const m = draft.moment;
  useEffect(() => {
    if (t === null) return;
    if (t >= draft.trimEnd) {
      const id = setTimeout(() => setT(null), 600);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setT(t + 1), 60);
    return () => clearTimeout(id);
  }, [t, draft.trimEnd]);
  const atPeak = t !== null && Math.abs(t - m.beatAt) <= 2;
  const caption = t === null ? null : t < m.beatAt - 2 ? '…' : atPeak ? m.quote : t > m.beatAt ? '(reaction)' : '…';
  return (
    <div className="preview">
      <ClipCard draft={draft} caption={caption} flash={atPeak} preview />
      <div>
        <button className="btn" onClick={() => setT(t === null ? draft.trimStart : null)}>{t === null ? '▶ Play preview' : `■ Stop (${t - draft.trimStart}s)`}</button>
        <p className="muted small">The preview plays your cut. If the peak line never flashes up, you trimmed out the key beat.</p>
      </div>
    </div>
  );
}

function ReadyView({ draft }: { draft: ClipDraft }): JSX.Element {
  const openPanel = useGame((s) => s.openPanel);
  const setPublish = useGame((s) => s.setPublishDraft);
  const reopen = useGame((s) => s.reopenDraft);
  const discard = useGame((s) => s.discardDraft);
  return (
    <div className="ready">
      <ClipCard draft={draft} quality={draft.quality ?? 0} />
      <div>
        <h3>Rendered and ready</h3>
        <p className="muted">Edit quality {draft.quality}/100. Pick the platform where this moment's audience lives.</p>
        <div className="row">
          <button
            className="btn primary big"
            onClick={() => {
              setPublish(draft.id);
              openPanel('publish');
            }}
          >
            Publish →
          </button>
          <button className="btn ghost" onClick={() => reopen(draft.id)}>Re-open edit</button>
          <ConfirmButton className="btn danger ghost" label="Discard" confirmLabel="Click again to discard" onConfirm={() => discard(draft.id)} />
        </div>
      </div>
    </div>
  );
}
