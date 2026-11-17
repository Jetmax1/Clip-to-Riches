import { BALANCE } from '../../data/balance';
import { CATEGORY_LABEL } from '../../data/editorOptions';
import { PLATFORMS, PLATFORM_IDS } from '../../data/platforms';
import { useEffect, useState } from 'react';
import { findStreamer } from '../../data/streamers';
import { recentSameCategory } from '../../sim/engine';
import { isSettled, lengthFit, previewFit } from '../../sim/publishing';
import { generateTrends } from '../../sim/streams';
import { streamDayOf } from '../../sim/time';
import { useGame } from '../../state/store';
import type { ClipDraft, PublishedClip } from '../../types/game';
import { Empty, Meter, Sparkline, Stars } from '../components/Bits';
import { ClipCard } from '../components/ClipCard';
import { compact, money } from '../format';

export function PublishingCenter(): JSX.Element {
  const game = useGame((s) => s.game)!;
  const publishId = useGame((s) => s.ui.publishDraftId);
  const setPublish = useGame((s) => s.setPublishDraft);
  const openPanel = useGame((s) => s.openPanel);
  const lastId = useGame((s) => s.ui.lastPublishedClipId);
  const ready = game.drafts.filter((d) => d.status === 'ready');
  // Never auto-select: after publishing, a second click must not publish a different clip.
  const selected = ready.find((d) => d.id === publishId) ?? (lastId === null && ready.length === 1 ? ready[0]! : null);
  const lastClip = lastId ? game.published.find((c) => c.id === lastId) ?? null : null;
  const live = [...game.published].reverse().slice(0, 6);

  return (
    <div className="publish">
      <aside className="queue" aria-label="Ready clips">
        <h3 className="col-title">Ready to publish ({ready.length})</h3>
        {ready.length === 0 && <p className="muted small">No rendered clips. Finish one in the Clip Studio.</p>}
        {ready.map((d) => (
          <button key={d.id} className={`queue-item${d.id === selected?.id ? ' selected' : ''}`} onClick={() => setPublish(d.id)} aria-pressed={d.id === selected?.id}>
            <span className="qi-body">
              <span className="qi-title">{d.title}</span>
              <span className="qi-status ready">Q{d.quality} · {CATEGORY_LABEL[d.moment.category]}</span>
            </span>
          </button>
        ))}
        <button className="btn ghost" onClick={() => openPanel('studio')}>Open Clip Studio</button>
      </aside>

      <section className="publish-main">
        {selected ? (
          <PlatformPicker draft={selected} />
        ) : lastClip ? (
          <div className="published-summary">
            <h3>Published!</h3>
            <p>
              <b>{lastClip.title}</b> is live on <span style={{ color: PLATFORMS[lastClip.platform].color }}>{PLATFORMS[lastClip.platform].name}</span>. Watch it below.
            </p>
            <p className="muted">{ready.length > 0 ? 'Pick another rendered clip on the left to publish it.' : 'Render another clip in the Clip Studio to keep going.'}</p>
          </div>
        ) : ready.length > 0 ? (
          <Empty title="Choose a clip">
            <p>Select one of your rendered clips on the left to see where it fits best.</p>
          </Empty>
        ) : (
          <Empty title="Nothing ready yet">
            <p>Render a clip in the Clip Studio, then come back to choose a platform.</p>
          </Empty>
        )}

        <h3 className="section-title">Live performance</h3>
        {live.length === 0 ? (
          <p className="muted">Published clips will show their views here in real time.</p>
        ) : (
          <div className="live-list">
            {live.map((c) => (
              <LiveClip key={c.id} clip={c} now={game.minute} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PlatformPicker({ draft }: { draft: ClipDraft }): JSX.Element {
  const game = useGame((s) => s.game)!;
  const publish = useGame((s) => s.publish);
  const streamer = findStreamer(draft.moment.streamerId);
  const trends = generateTrends(game.worldSeed, streamDayOf(game.minute));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => setBusy(false), 700);
    return () => clearTimeout(id);
  }, [busy]);
  const len = draft.trimEnd - draft.trimStart;
  const canAfford = game.energy >= BALANCE.publish.energy;

  return (
    <div className="picker">
      <div className="picker-clip">
        <ClipCard draft={draft} quality={draft.quality ?? 0} />
      </div>
      <div className="platforms">
        {PLATFORM_IDS.map((id) => {
          const p = PLATFORMS[id];
          const acct = game.platforms[id];
          const fit = previewFit(draft, id, streamer, trends, game.minute);
          const trendMult = trends[id][draft.moment.category];
          const lf = lengthFit(len, p.idealLength);
          const rule = p.monetization;
          return (
            <article key={id} className="platform" style={{ ['--pc' as string]: p.color }}>
              <header>
                <h4>{p.name}</h4>
                <span className="muted small">{p.format}</span>
              </header>
              <p className="small">{p.tagline}</p>
              <dl className="pf-stats">
                <div>
                  <dt>Overall fit</dt>
                  <dd><Stars value={1 + Math.round(fit.overall * 4)} label="Overall fit" /></dd>
                </div>
                <div>
                  <dt>Audience match</dt>
                  <dd><Meter value={(fit.audienceFit - 0.4) / 0.6} color={p.color} label="Audience match" /></dd>
                </div>
                <div>
                  <dt>{CATEGORY_LABEL[draft.moment.category]} today</dt>
                  <dd className={trendMult > 1.05 ? 'good' : trendMult < 0.95 ? 'bad' : ''}>
                    {trendMult > 1.05 ? `Trending ×${trendMult}` : trendMult < 0.95 ? `Cold ×${trendMult}` : 'Normal'}
                  </dd>
                </div>
                <div>
                  <dt>Length {len}s</dt>
                  <dd className={lf >= 1 ? 'good' : 'bad'}>{lf >= 1 ? 'Ideal' : `Prefers ${p.idealLength[0]}–${p.idealLength[1]}s`}</dd>
                </div>
              </dl>
              <div className="monet">
                {acct.monetized ? (
                  <span className="good small">● Monetized · {money(rule.rpm)} per 1K views</span>
                ) : (
                  <>
                    <span className="small">Not monetized · {rule.programName}</span>
                    {rule.minFollowers > 0 && (
                      <span className="monet-row">
                        <span className="small muted">Followers {acct.followers}/{rule.minFollowers}</span>
                        <Meter value={acct.followers / rule.minFollowers} color={p.color} label="Follower requirement" />
                      </span>
                    )}
                    {rule.minTotalViews > 0 && (
                      <span className="monet-row">
                        <span className="small muted">Views {compact(acct.totalViews)}/{compact(rule.minTotalViews)}</span>
                        <Meter value={acct.totalViews / rule.minTotalViews} color={p.color} label="View requirement" />
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="muted small">{p.algorithmNote}</p>
              {recentSameCategory(game, id, draft.moment.category) > 0 && (
                <p className="bad small">
                  You posted {recentSameCategory(game, id, draft.moment.category)} {CATEGORY_LABEL[draft.moment.category].toLowerCase()} clip(s) here in the last day — this audience is getting tired of them.
                </p>
              )}
              <button
                className="btn primary"
                disabled={!canAfford || busy}
                onClick={() => {
                  setBusy(true);
                  publish(draft.id, id);
                }} title={canAfford ? `Publish on ${p.name}` : 'Not enough energy'}>
                Publish on {p.name}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function LiveClip({ clip, now }: { clip: PublishedClip; now: number }): JSX.Element {
  const p = PLATFORMS[clip.platform];
  const settled = isSettled(clip, now);
  return (
    <div className="live-clip">
      <span className="lc-plat" style={{ background: p.color }}>{p.name}</span>
      <span className="lc-title">
        {clip.title}
        {clip.factors.viral && <em className="viral-badge">VIRAL</em>}
      </span>
      <Sparkline points={clip.history.map((h) => h.views).concat(clip.views)} color={p.color} />
      <span className="lc-num"><b>{compact(clip.views)}</b> views</span>
      <span className="lc-num"><b>{compact(clip.likes)}</b> likes</span>
      <span className="lc-num"><b>+{compact(clip.followersGained)}</b> fans</span>
      <span className="lc-num"><b>{money(clip.revenue)}</b></span>
      <span className={`lc-state ${settled ? 'muted' : 'good'}`}>{settled ? 'settled' : 'growing'}</span>
    </div>
  );
}
